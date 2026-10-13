import { db } from "./db";
import { appUrl } from "./config";
import { emailHtml, sendMail } from "./mail";
import { pushToMember, type PushPayload } from "./push";
import { canSendNotice, sendSms } from "./sms";
import { fallbackChannels, type ContactPref } from "./contact";
import { DateTime } from "luxon";

export type Audience = "everyone" | "admins" | "presidency" | "teachers" | `group:${number}`;

export interface Recipient {
  id: number;
  ward_id: number;
  email: string | null;
  phone: string | null;
  contact_pref: ContactPref;
  display_name: string;
  sms_consent_at: string | null;
  always_email: number;
  always_text: number;
}

export const RECIPIENT_COLUMNS = "id, ward_id, email, phone, contact_pref, display_name, sms_consent_at, always_email, always_text";
const BASE = `SELECT ${RECIPIENT_COLUMNS} FROM members WHERE ward_id = ? AND status = 'active'`;

export function recipientById(id: number | null | undefined): Recipient | undefined {
  if (!id) return undefined;
  return d().prepare(`SELECT ${RECIPIENT_COLUMNS} FROM members WHERE id = ? AND status = 'active'`).get(id) as Recipient | undefined;
}
const d = () => db();

/** Active members (everyone who joined and was approved) in an audience. */
export function audienceMembers(wardId: number, audience: Audience, opts: { tz?: string } = {}): Recipient[] {
  const d = db();
  if (audience === "everyone") return d.prepare(BASE).all(wardId) as Recipient[];
  if (audience === "admins") return d.prepare(BASE + " AND role IN ('admin','presidency')").all(wardId) as Recipient[];
  if (audience === "presidency") return d.prepare(BASE + " AND role = 'presidency'").all(wardId) as Recipient[];
  if (audience === "teachers") {
    const today = DateTime.now().setZone(opts.tz || "America/Boise").toISODate()!;
    const until = DateTime.fromISO(today).plus({ weeks: 5 }).toISODate()!;
    return d
      .prepare(BASE + " AND id IN (SELECT teacher_id FROM lessons WHERE ward_id = ? AND date BETWEEN ? AND ? AND teacher_id IS NOT NULL)")
      .all(wardId, wardId, today, until) as Recipient[];
  }
  if (audience.startsWith("group:")) {
    const groupId = Number(audience.slice(6));
    return d
      .prepare(BASE + " AND id IN (SELECT member_id FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.id = ? AND g.ward_id = ?)")
      .all(wardId, groupId, wardId) as Recipient[];
  }
  return [];
}

export function audienceLabel(wardId: number, audience: Audience): string {
  switch (audience) {
    case "everyone":
      return "Everyone";
    case "admins":
      return "Admins (presidency, bishop, Stake High Council)";
    case "presidency":
      return "Presidency";
    case "teachers":
      return "Upcoming teachers";
  }
  const g = db().prepare("SELECT name FROM groups WHERE id = ? AND ward_id = ?").get(Number(audience.slice(6)), wardId) as { name: string } | undefined;
  return g ? `Group: ${g.name}` : "Group";
}

/** Short text for a notice, with the ward's name so people know who it's from. */
function smsBody(wardName: string, payload: PushPayload, url: string) {
  const text = `${wardName}: ${payload.title}. ${payload.body}`.replace(/\s+/g, " ").trim();
  return `${text.length > 280 ? text.slice(0, 277) + "…" : text} ${url}`;
}

/**
 * Sends to each recipient every way they chose: push to their devices, plus
 * email and/or text every time if they asked for that. If none of those reach
 * them, their backup choice (contact_pref) is used. Texts only go to members
 * who agreed to them themselves.
 */
export async function notify(recipients: Recipient[], payload: PushPayload, opts: { fallback?: boolean } = {}) {
  const fallback = opts.fallback ?? true;
  let push = 0;
  let email = 0;
  let text = 0;
  let reached = 0;
  const url = payload.url ? appUrl() + payload.url : appUrl();
  const wardNames = new Map<number, string>();

  const sendEmail = async (r: Recipient) =>
    !!r.email &&
    (await sendMail({
      to: r.email,
      subject: payload.title,
      text: `${payload.body}\n\n${url}`,
      html: emailHtml(payload.title, payload.body, { url, label: "Open the app" }),
    }));
  const sendText = async (r: Recipient) => {
    if (!r.phone) return false;
    if (!wardNames.has(r.ward_id)) wardNames.set(r.ward_id, (d().prepare("SELECT name FROM wards WHERE id = ?").get(r.ward_id) as { name: string }).name);
    const res = await sendSms(r.ward_id, r.phone, smsBody(wardNames.get(r.ward_id)!, payload, url), "notice");
    // They replied STOP: stop texting them; use email if they have one.
    if (res === "opted_out") d().prepare("UPDATE members SET contact_pref = CASE WHEN email IS NOT NULL THEN 'email' ELSE 'none' END, always_text = 0 WHERE id = ?").run(r.id);
    return res === "sent";
  };

  for (const r of recipients) {
    const canText = !!r.sms_consent_at && !!r.phone && canSendNotice(r.ward_id);
    let got = false;
    if ((await pushToMember(r.id, payload)) > 0) {
      push++;
      got = true;
    }
    if (fallback) {
      const always = [...(r.always_email && r.email ? ["email" as const] : []), ...(r.always_text && canText ? ["text" as const] : [])];
      const channels = always.length ? always : got ? [] : fallbackChannels(r, canText);
      const deliver = async (channel: "email" | "text") => {
        if (channel === "email" && (await sendEmail(r))) email++;
        else if (channel === "text" && (await sendText(r))) text++;
        else return;
        got = true;
      };
      for (const channel of channels) await deliver(channel);
      // An "every time" channel failed (e.g. the text limit): fall back to their backup choice.
      if (!got && always.length) {
        for (const channel of fallbackChannels(r, canText).filter((c) => !always.includes(c))) await deliver(channel);
      }
    }
    if (got) reached++;
  }
  return { push, email, text, reached };
}

/** Records a dedupe key. Returns false if this notification was already sent. */
export function claimOnce(key: string): boolean {
  const res = db().prepare("INSERT OR IGNORE INTO sent_notifications (key) VALUES (?)").run(key);
  return res.changes > 0;
}
