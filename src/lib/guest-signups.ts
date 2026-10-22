import { reminderSettings } from "./reminder-settings";
import crypto from "crypto";
import { db } from "./db";
import { sha256 } from "./auth-core";
import { emailHtml, sendMail } from "./mail";
import { canSendNotice, codeTextFooter, sendSms } from "./sms";
import { formatDate } from "./time";
import { shareUrl } from "./public-shares";

// People without an account signing up for a service opportunity shared publicly.
// They confirm with a code (by email, or by text only if they agreed to texts).

/** The words they agree to by ticking the box (kept with their sign-up as proof). */
export const GUEST_TEXT_CONSENT =
  "Text me a confirmation code and reminders for this sign-up. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

export interface Guest {
  id: number;
  slot_id: number;
  name: string;
  contact: string;
  contact_kind: "email" | "phone";
  note: string;
  sms_consent_at: string | null;
  confirmed_at: string | null;
  cancel_token: string;
}

/** Confirmed guests in each slot of a service opportunity. */
export function confirmedGuests(signupId: number): Guest[] {
  return db()
    .prepare("SELECT g.* FROM signup_guests g JOIN signup_slots sl ON sl.id = g.slot_id WHERE sl.signup_id = ? AND g.confirmed_at IS NOT NULL ORDER BY g.confirmed_at")
    .all(signupId) as Guest[];
}

/** How many have a spot in this slot (members and confirmed guests). */
export function slotTaken(slotId: number): number {
  return (
    db()
      .prepare("SELECT (SELECT COUNT(*) FROM signup_entries WHERE slot_id = ?) + (SELECT COUNT(*) FROM signup_guests WHERE slot_id = ? AND confirmed_at IS NOT NULL) AS n")
      .get(slotId, slotId) as { n: number }
  ).n;
}

/** "John S." */
export const guestShortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

interface SignupInfo {
  title: string;
  date: string | null;
  org_id: number;
  slot_label: string;
}

const signupFor = (slotId: number) =>
  db().prepare("SELECT s.title, s.date, s.org_id, sl.label AS slot_label FROM signup_slots sl JOIN signups s ON s.id = sl.signup_id WHERE sl.id = ?").get(slotId) as SignupInfo | undefined;

/** Saves a guest's sign-up (not yet confirmed) and sends them a code. Returns their id. */
export async function startGuestSignup(g: { slotId: number; name: string; contact: string; kind: "email" | "phone"; note: string; textConsent: boolean }): Promise<number | null> {
  const s = signupFor(g.slotId);
  if (!s) return null;
  // A phone number is only texted if they ticked the box.
  if (g.kind === "phone" && !g.textConsent) return null;
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const id = Number(
    db()
      .prepare(
        `INSERT INTO signup_guests (slot_id, name, contact, contact_kind, note, sms_consent_at, consent_text, code_hash, cancel_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        g.slotId,
        g.name,
        g.contact,
        g.kind,
        g.note,
        g.textConsent ? new Date().toISOString() : null,
        g.textConsent ? GUEST_TEXT_CONSENT : null,
        "",
        crypto.randomBytes(16).toString("base64url"),
      ).lastInsertRowid,
  );
  db().prepare("UPDATE signup_guests SET code_hash = ? WHERE id = ?").run(sha256(`guest:${id}:${code}`), id);
  const what = `${s.title}${s.date ? ` (${formatDate(s.date, "short")})` : ""}`;
  if (g.kind === "phone") {
    await sendSms(s.org_id, g.contact, `${code} is your code to confirm signing up for ${what}. Reply STOP to opt out.${codeTextFooter(code)}`, "code");
  } else {
    const text = `Hi ${g.name},\n\nYour code to confirm signing up for ${what} is: ${code}\n\nIt expires in 30 minutes. If you didn't sign up, you can ignore this email.`;
    await sendMail({ to: g.contact, subject: `Your code: ${code}`, text, html: emailHtml(`Confirm your sign-up`, text) });
  }
  return id;
}

/** Checks the code (5 tries, 30 minutes). On success the spot is theirs if one is still open. */
export function confirmGuest(id: number, code: string): "ok" | "wrong" | "full" | "expired" {
  const d = db();
  const g = d.prepare("SELECT * FROM signup_guests WHERE id = ?").get(id) as (Guest & { code_hash: string; attempts: number; created_at: string }) | undefined;
  if (!g || g.confirmed_at) return g?.confirmed_at ? "ok" : "expired";
  if (g.attempts >= 5 || Date.parse(g.created_at.replace(" ", "T") + "Z") < Date.now() - 30 * 60_000) return "expired";
  if (sha256(`guest:${id}:${code.replace(/\D/g, "")}`) !== g.code_hash) {
    d.prepare("UPDATE signup_guests SET attempts = attempts + 1 WHERE id = ?").run(id);
    return "wrong";
  }
  const cap = (d.prepare("SELECT capacity FROM signup_slots WHERE id = ?").get(g.slot_id) as { capacity: number }).capacity;
  return d.transaction(() => {
    if (slotTaken(g.slot_id) >= cap) return "full" as const;
    d.prepare("UPDATE signup_guests SET confirmed_at = datetime('now') WHERE id = ?").run(id);
    return "ok" as const;
  }).immediate();
}

/** Tells a guest they're signed up, with a link to cancel. */
export async function sendGuestConfirmation(id: number, token: string) {
  const g = db().prepare("SELECT * FROM signup_guests WHERE id = ?").get(id) as Guest | undefined;
  const s = g && signupFor(g.slot_id);
  if (!g || !s) return;
  const cancel = `${shareUrl(token)}/cancel?g=${g.id}&t=${g.cancel_token}`;
  const what = `${s.title}, ${s.slot_label}${s.date ? ` on ${formatDate(s.date, "short")}` : ""}`;
  if (g.contact_kind === "phone" && g.sms_consent_at) {
    if (canSendNotice(s.org_id)) await sendSms(s.org_id, g.contact, `You're signed up for ${what}. Thank you! Can't make it? ${cancel}`, "notice");
  } else if (g.contact_kind === "email") {
    const text = `Hi ${g.name},\n\nYou're signed up for ${what}. Thank you!\n\nCan't make it after all? Cancel here: ${cancel}`;
    await sendMail({ to: g.contact, subject: `You're signed up: ${s.title}`, text, html: emailHtml(`You're signed up`, text, { url: cancel, label: "Can't make it? Cancel" }) });
  }
}

export function cancelGuest(id: number, cancelToken: string): boolean {
  return db().prepare("DELETE FROM signup_guests WHERE id = ? AND cancel_token = ?").run(id, cancelToken).changes > 0;
}

/** A leader takes a guest off a service opportunity in their organization. */
export function removeGuest(orgId: number, id: number): boolean {
  return (
    db()
      .prepare("DELETE FROM signup_guests WHERE id = ? AND slot_id IN (SELECT sl.id FROM signup_slots sl JOIN signups s ON s.id = sl.signup_id WHERE s.org_id = ?)")
      .run(id, orgId).changes > 0
  );
}

/** Someone replied STOP from this number: no more texts to any guest sign-up with it. */
export function guestOptOut(phone: string): number {
  return db().prepare("UPDATE signup_guests SET sms_consent_at = NULL WHERE contact = ? AND contact_kind = 'phone' AND sms_consent_at IS NOT NULL").run(phone).changes;
}

export interface GuestReminder {
  key: string;
  guestId: number;
  orgId: number;
  name: string;
  contact: string;
  kind: "email" | "phone";
  texts: boolean;
  title: string;
  when: string;
  date: string;
  slot: string;
  token: string | null;
  cancelToken: string;
}

/**
 * Guests' reminders: the service opportunity's reminder days, from 8 AM in the
 * ward's time zone. Texts only to those who agreed to them; otherwise email.
 */
export function guestRemindersDue(now: Date = new Date()): GuestReminder[] {
  const rows = db()
    .prepare(
      `SELECT g.id, g.name, g.contact, g.contact_kind, g.sms_consent_at, g.cancel_token, s.id AS signup_id, s.org_id, s.title, s.date, s.reminder1_days, s.reminder2_days,
         sl.label AS slot, w.timezone, (SELECT token FROM public_shares p WHERE p.signup_id = s.id ORDER BY created_at DESC LIMIT 1) AS token
       FROM signup_guests g JOIN signup_slots sl ON sl.id = g.slot_id JOIN signups s ON s.id = sl.signup_id JOIN orgs o ON o.id = s.org_id JOIN wards w ON w.id = o.ward_id
       WHERE g.confirmed_at IS NOT NULL AND s.date IS NOT NULL AND s.closed = 0`,
    )
    .all() as { id: number; name: string; contact: string; contact_kind: "email" | "phone"; sms_consent_at: string | null; cancel_token: string; signup_id: number; org_id: number; title: string; date: string; reminder1_days: number | null; reminder2_days: number | null; slot: string; timezone: string; token: string | null }[];
  const out: GuestReminder[] = [];
  for (const r of rows) {
    const local = new Date(now.toLocaleString("en-US", { timeZone: r.timezone }));
    if (local.getHours() < reminderSettings(r.org_id).morningHour || local.getHours() >= 20) continue;
    const today = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    const days = Math.round((Date.parse(r.date) - Date.parse(today)) / 86_400_000);
    for (const [d, tag] of [
      [r.reminder1_days, "r1"],
      [r.reminder2_days, "r2"],
    ] as const) {
      if (d === null || d !== days) continue;
      out.push({
        key: `guest-${tag}:${r.id}:${r.date}`,
        guestId: r.id,
        orgId: r.org_id,
        name: r.name,
        contact: r.contact,
        kind: r.contact_kind,
        texts: r.contact_kind === "phone" && !!r.sms_consent_at,
        title: r.title,
        when: d === 0 ? "today" : d === 1 ? "tomorrow" : formatDate(r.date, "short"),
        date: formatDate(r.date, "short"),
        slot: r.slot,
        token: r.token,
        cancelToken: r.cancel_token,
      });
    }
  }
  return out;
}

export async function sendGuestReminder(r: GuestReminder) {
  const cancel = r.token ? `${shareUrl(r.token)}/cancel?g=${r.guestId}&t=${r.cancelToken}` : "";
  const text = `Reminder: you signed up for ${r.title} (${r.slot}) ${r.when === r.date ? `on ${r.date}` : r.when}. Thank you for serving!${cancel ? ` Can't make it? ${cancel}` : ""}`;
  if (r.texts) {
    if (canSendNotice(r.orgId)) await sendSms(r.orgId, r.contact, text, "notice");
  } else if (r.kind === "email") {
    await sendMail({ to: r.contact, subject: `Reminder: ${r.title}`, text: `Hi ${r.name},\n\n${text}`, html: emailHtml(`Reminder: ${r.title}`, `Hi ${r.name},\n\n${text}`) });
  }
}
