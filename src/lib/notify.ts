import { db } from "./db";
import { appUrl } from "./config";
import { emailHtml, sendMail } from "./mail";
import { pushToMember, type PushPayload } from "./push";
import { readUpload } from "./uploads";
import { canSendNotice, sendSms } from "./sms";
import { fallbackChannels, type ContactPref } from "./contact";
import { DateTime } from "luxon";
import { getOrg, orgFullName } from "./orgs";
import { withOrg } from "./org-cookie";

export type Audience = "everyone" | "admins" | "presidency" | "teachers" | `group:${number}`;

/** A member to notify, with the organization the notification is about (org_id). */
export interface Recipient {
  id: number;
  org_id: number;
  email: string | null;
  phone: string | null;
  contact_pref: ContactPref;
  display_name: string;
  sms_consent_at: string | null;
  always_email: number;
  always_text: number;
}

/** Columns for a Recipient from members m; the first ? is the organization id. */
export const RECIPIENT_COLUMNS = "m.id, ? AS org_id, m.email, m.phone, m.contact_pref, m.display_name, m.sms_consent_at, m.always_email, m.always_text";
// Members of an organization (first ? org id for the column, second for the join).
const BASE = `SELECT ${RECIPIENT_COLUMNS} FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ? WHERE m.status = 'active'`;

/** One member, to notify about something in an organization. */
export function recipientById(id: number | null | undefined, orgId: number): Recipient | undefined {
  if (!id) return undefined;
  return d().prepare(`SELECT ${RECIPIENT_COLUMNS} FROM members m WHERE m.id = ? AND m.status = 'active'`).get(orgId, id) as Recipient | undefined;
}
const d = () => db();

/**
 * Active members of an organization in an audience. "everyone" is those who get
 * the organization's notifications; leaders always get them.
 */
export function audienceMembers(orgId: number, audience: Audience, opts: { tz?: string } = {}): Recipient[] {
  const d = db();
  if (audience === "everyone") return d.prepare(BASE + " AND (om.notify = 1 OR om.role <> 'member')").all(orgId, orgId) as Recipient[];
  if (audience === "admins") return d.prepare(BASE + " AND om.role IN ('admin','presidency')").all(orgId, orgId) as Recipient[];
  if (audience === "presidency") return d.prepare(BASE + " AND om.role = 'presidency'").all(orgId, orgId) as Recipient[];
  if (audience === "teachers") {
    const today = DateTime.now().setZone(opts.tz || "America/Boise").toISODate()!;
    const until = DateTime.fromISO(today).plus({ weeks: 5 }).toISODate()!;
    return d
      .prepare(`SELECT ${RECIPIENT_COLUMNS} FROM members m WHERE m.status = 'active' AND m.id IN (SELECT teacher_id FROM lessons WHERE org_id = ? AND date BETWEEN ? AND ? AND teacher_id IS NOT NULL)`)
      .all(orgId, orgId, today, until) as Recipient[];
  }
  if (audience.startsWith("group:")) {
    const groupId = Number(audience.slice(6));
    return d
      .prepare(`SELECT ${RECIPIENT_COLUMNS} FROM members m WHERE m.status = 'active' AND m.id IN (SELECT member_id FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.id = ? AND g.org_id = ?)`)
      .all(orgId, groupId, orgId) as Recipient[];
  }
  return [];
}

export function audienceLabel(orgId: number, audience: Audience): string {
  switch (audience) {
    case "everyone":
      return "Everyone";
    case "admins":
      return "Leaders";
    case "presidency":
      return getOrg(orgId)?.kind === "ward" ? "Bishopric" : "Presidency";
    case "teachers":
      return "Upcoming teachers";
  }
  const g = db().prepare("SELECT name FROM groups WHERE id = ? AND org_id = ?").get(Number(audience.slice(6)), orgId) as { name: string } | undefined;
  return g ? `Group: ${g.name}` : "Group";
}

/**
 * Short text for a notice, with the ward and organization so people know who
 * it's from. A personal note is just the words and the sender's name.
 */
function smsBody(wardName: string, payload: PushPayload, url: string) {
  if (payload.personal) return `${(payload.textBody ?? payload.body).trim().slice(0, 900)}\n\n- ${payload.personal.from}`;
  // Already says who it's from (a visit invitation): the words in full, then the link.
  if (payload.textLink) return `${(payload.textBody ?? payload.body).trim().slice(0, 900)}\n\n${payload.textLink}: ${url}`;
  // A member's message to a leader: their words, who it's from, then the link.
  if (payload.fullText) return `${(payload.textBody ?? payload.body).trim().slice(0, 900)}\n\n${payload.textTitle ?? payload.title}\n\nReply in app: ${url}`;
  const text = `${wardName}: ${payload.title}. ${payload.textBody ?? payload.body}`.replace(/\s+/g, " ").trim();
  return `${text.length > 280 ? text.slice(0, 277) + "…" : text} ${url}`;
}

/**
 * Sends to each recipient every way they chose: push to their devices, plus
 * email and/or text every time if they asked for that. If none of those reach
 * them, their backup choice (contact_pref) is used. Texts only go to members
 * who agreed to them themselves.
 */
export async function notify(recipients: Recipient[], payload: PushPayload, opts: { fallback?: boolean; only?: "push" | "text" } = {}) {
  const fallback = opts.fallback ?? true;
  let push = 0;
  let email = 0;
  let text = 0;
  let reached = 0;
  const orgNames = new Map<number, string>();

  // A flyer goes with each email (read once).
  const upload = payload.attachment ? readUpload(payload.attachment.file) : null;
  const attachments = upload && payload.attachment ? [{ filename: attachmentName(payload.attachment.name, payload.attachment.file), content: upload.data, contentType: upload.type }] : undefined;
  const sendEmail = async (r: Recipient, url: string) => {
    if (!r.email) return false;
    if (payload.personal) {
      const text = `${payload.body}\n\n- ${payload.personal.from}`;
      return sendMail({ to: r.email, subject: `A message from ${payload.personal.from}`, text, html: emailHtml("", text) });
    }
    const body = payload.emailNote ? `${payload.body}\n\n${payload.emailNote}` : payload.body;
    return sendMail({
      to: r.email,
      subject: payload.title,
      text: `${body}\n\n${url}`,
      html: emailHtml(payload.title, body, { url, label: payload.linkLabel ?? "Open the app" }),
      attachments,
    });
  };
  const sendText = async (r: Recipient, url: string) => {
    if (!r.phone) return false;
    if (!orgNames.has(r.org_id)) orgNames.set(r.org_id, orgFullName(r.org_id));
    const res = await sendSms(r.org_id, r.phone, smsBody(orgNames.get(r.org_id)!, payload, url), "notice");
    // Which organizations texted them lately (to ask which one a reply is for).
    if (res === "sent") d().prepare("INSERT INTO member_text_orgs (member_id, org_id) VALUES (?, ?) ON CONFLICT DO UPDATE SET at = datetime('now')").run(r.id, r.org_id);
    // A texted reply goes to this organization (and, after a member's message, to that member).
    if (res === "sent")
      d()
        .prepare("UPDATE members SET last_text_org_id = ?, text_reply_member_id = ?, text_reply_private = ?, text_as_member = ? WHERE id = ?")
        .run(r.org_id, payload.replyTo?.memberId ?? null, payload.replyTo?.private ? 1 : 0, payload.asMember ? 1 : 0, r.id);
    // They replied STOP: stop texting them; use email if they have one.
    if (res === "opted_out") d().prepare("UPDATE members SET contact_pref = CASE WHEN email IS NOT NULL THEN 'email' ELSE 'none' END, always_text = 0 WHERE id = ?").run(r.id);
    return res === "sent";
  };

  // Nothing is sent from a ward that's still under review.
  const pendingOrgs = new Set((d().prepare("SELECT o.id FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE w.pending = 1").all() as { id: number }[]).map((o) => o.id));
  recipients = recipients.filter((r) => !pendingOrgs.has(r.org_id));
  for (const r of recipients) {
    // Kept for the member's Notifications list; the link marks it read when they open it.
    const logId = Number(
      d()
        .prepare("INSERT INTO notification_log (member_id, org_id, title, body, url) VALUES (?, ?, ?, ?, ?)")
        .run(r.id, r.org_id, payload.title, payload.body, payload.url ?? "/").lastInsertRowid,
    );
    // ?org= opens it in the organization it's about.
    const p = { ...payload, url: withOrg(withSeen(payload.url ?? "/", logId), r.org_id) };
    const url = appUrl() + p.url;
    const canText = !!r.sms_consent_at && !!r.phone && canSendNotice(r.org_id);
    let got = false;
    // A member's own reminder says how: by text (up to their limit), or as an app
    // notification. If that way can't reach them, the next best does.
    if (opts.only) {
      if (opts.only === "text" && canText && (await sendText(r, `${appUrl()}/n/${logId}`))) {
        text++;
        got = true;
      }
      if (!got && (await pushToMember(r.id, p)) > 0) {
        push++;
        got = true;
      }
      if (!got && (await sendEmail(r, url))) {
        email++;
        got = true;
      }
      if (got) reached++;
      continue;
    }
    if ((await pushToMember(r.id, p)) > 0) {
      push++;
      got = true;
    }
    if (fallback) {
      const always = [...(r.always_email && r.email ? ["email" as const] : []), ...(r.always_text && canText ? ["text" as const] : [])];
      const channels = always.length ? always : got ? [] : fallbackChannels(r, canText);
      const deliver = async (channel: "email" | "text") => {
        if (channel === "email" && (await sendEmail(r, url))) email++;
        // Texts get the short link (/n/<id>), which opens the same page.
        else if (channel === "text" && (await sendText(r, `${appUrl()}/n/${logId}`))) text++;
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

/** Adds ?n=<id> so opening the link marks that notification read. */
export function withSeen(path: string, id: number) {
  const [base, hash] = path.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}n=${id}${hash ? `#${hash}` : ""}`;
}

/** Records a dedupe key. Returns false if this notification was already sent. */
export function claimOnce(key: string): boolean {
  const res = db().prepare("INSERT OR IGNORE INTO sent_notifications (key) VALUES (?)").run(key);
  return res.changes > 0;
}

/** "Flyer.pdf": the uploaded file's own name, with the right extension. */
function attachmentName(name: string, file: string) {
  const ext = file.slice(file.lastIndexOf("."));
  const base = name.replace(/[^\w .()-]/g, "").trim() || "Flyer";
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}
