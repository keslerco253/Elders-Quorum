import { db } from "./db";
import { appUrl } from "./config";
import { emailHtml, sendMail } from "./mail";
import { pushToMember, type PushPayload } from "./push";
import { readUpload } from "./uploads";
import { canSendNotice, sendSms, toGsm7 } from "./sms";
import { fallbackChannels, type ContactPref } from "./contact";
import { DateTime } from "luxon";
import { getOrg, orgFullName } from "./orgs";
import { withOrg } from "./org-cookie";
import { quietUntil } from "./quiet-hours";

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
  // At most 2 segments (306 letters), the link included.
  const text = toGsm7(`${wardName}: ${payload.title}. ${payload.textBody ?? payload.body}`.replace(/\s+/g, " ").trim());
  const room = 306 - url.length - 1;
  return `${text.length > room ? text.slice(0, room - 3).trimEnd() + "..." : text} ${url}`;
}

/**
 * Sends to each recipient every way they chose: push to their devices, plus
 * email and/or text every time if they asked for that. If none of those reach
 * them, their backup choice (contact_pref) is used. Texts only go to members
 * who agreed to them themselves.
 */
export async function notify(
  recipients: Recipient[],
  payload: PushPayload,
  opts: {
    fallback?: boolean;
    only?: ("push" | "text" | "email")[];
    /** Something sent to this person directly (a request, a personal message): if nothing reaches them, the presidency is asked to tell them another way. */
    followUp?: { what: string; url?: string };
    /** A reminder going out at the time chosen for it: not held for quiet hours. */
    scheduled?: boolean;
  } = {},
) {
  const fallback = opts.fallback ?? true;
  let push = 0;
  let email = 0;
  let text = 0;
  /** App notifications and texts held for the morning (quiet hours); counted in `push` and `text` too. */
  let held = 0;
  let reached = 0;
  const orgNames = new Map<number, string>();

  // A flyer goes with each email (read once).
  const upload = payload.attachment ? readUpload(payload.attachment.file) : null;
  const attachments = upload && payload.attachment ? [{ filename: attachmentName(payload.attachment.name, payload.attachment.file), content: upload.data, contentType: upload.type }] : undefined;
  const sendEmail = async (r: Recipient, url: string) => {
    if (!r.email) return false;
    if (payload.personal) {
      const text = `${payload.body}\n\n- ${payload.personal.from}`;
      return sendMail({ to: r.email, subject: `A message from ${payload.personal.from}`, text, html: emailHtml("", text), orgId: r.org_id });
    }
    const body = payload.emailNote ? `${payload.body}\n\n${payload.emailNote}` : payload.body;
    return sendMail({
      to: r.email,
      subject: payload.title,
      text: `${body}\n\n${url}`,
      html: emailHtml(payload.title, body, { url, label: payload.linkLabel ?? "Open the app" }),
      attachments,
      orgId: r.org_id,
    });
  };
  // Quiet hours (late at night, until the morning hour): app notifications and texts
  // wait for the morning; email goes now. Not for reminders at the times chosen for them.
  const quiet = new Map<number, string | null>();
  const quietFor = (orgId: number) => {
    if (opts.scheduled) return null;
    if (!quiet.has(orgId)) quiet.set(orgId, quietUntil(orgId));
    return quiet.get(orgId)!;
  };
  const pushNow = async (r: Recipient, p: PushPayload) => {
    const until = quietFor(r.org_id);
    if (until && hasPushDevice(r.id)) {
      d().prepare("INSERT INTO held_pushes (member_id, payload, send_at) VALUES (?, ?, ?)").run(r.id, JSON.stringify(p), until);
      held++;
      return 1;
    }
    return until ? 0 : pushToMember(r.id, p);
  };
  const sendText = async (r: Recipient, url: string) => {
    if (!r.phone) return false;
    if (!orgNames.has(r.org_id)) orgNames.set(r.org_id, orgFullName(r.org_id));
    const body = smsBody(orgNames.get(r.org_id)!, payload, url);
    const meta: TextMeta = { noReply: !!payload.noReply, replyMemberId: payload.replyTo?.memberId ?? null, replyPrivate: !!payload.replyTo?.private, asMember: !!payload.asMember };
    // Quiet hours: late at night, the text waits for the morning (app notifications and email don't).
    const until = quietFor(r.org_id);
    if (until) {
      d()
        .prepare("INSERT INTO held_texts (org_id, member_id, phone, body, no_reply, reply_member_id, reply_private, as_member, send_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(r.org_id, r.id, r.phone, body, meta.noReply ? 1 : 0, meta.replyMemberId, meta.replyPrivate ? 1 : 0, meta.asMember ? 1 : 0, until);
      held++;
      return true;
    }
    const res = await sendSms(r.org_id, r.phone, body, "notice");
    afterText(r.id, r.org_id, meta, res);
    return res === "sent";
  };

  // Nothing is sent from a ward that's still under review.
  const pendingOrgs = new Set((d().prepare("SELECT o.id FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE w.pending = 1").all() as { id: number }[]).map((o) => o.id));
  recipients = recipients.filter((r) => !pendingOrgs.has(r.org_id));
  for (const r of recipients) {
    // Kept for the member's Reminders & alerts list (messages are kept but left out of
    // it: they're in Messages); the link marks it read when they open it.
    const logId = Number(
      d()
        .prepare("INSERT INTO notification_log (member_id, org_id, title, body, url, message) VALUES (?, ?, ?, ?, ?, ?)")
        .run(r.id, r.org_id, payload.title, payload.body, payload.url ?? "/", payload.message ? 1 : 0).lastInsertRowid,
    );
    // ?org= opens it in the organization it's about.
    const p = { ...payload, url: withOrg(withSeen(payload.url ?? "/", logId), r.org_id) };
    // How it reached them (counted from here), kept with the log entry.
    const before = { push, email, text };
    const record = () => {
      const ways = [push > before.push && "push", email > before.email && "email", text > before.text && "text"].filter(Boolean).join(",");
      d().prepare("UPDATE notification_log SET delivered = ? WHERE id = ?").run(ways, logId);
      if (!ways && opts.followUp) noteUnreached(r.org_id, r.id, opts.followUp.what, opts.followUp.url ?? payload.url ?? "/");
    };
    const url = appUrl() + p.url;
    const canText = !!r.sms_consent_at && !!r.phone && canSendNotice(r.org_id);
    let got = false;
    // A member's own reminder says how: any of app notification, text (up to their
    // limit) and email. If none of those reaches them, the next best does.
    if (opts.only) {
      if (opts.only.includes("push") && (await pushNow(r, p)) > 0) {
        push++;
        got = true;
      }
      if (opts.only.includes("text") && canText && (await sendText(r, `${appUrl()}/n/${logId}`))) {
        text++;
        got = true;
      }
      if (opts.only.includes("email") && (await sendEmail(r, url))) {
        email++;
        got = true;
      }
      if (!got && !opts.only.includes("push") && (await pushNow(r, p)) > 0) {
        push++;
        got = true;
      }
      // (Not to someone who turned off everything but app notifications.)
      if (!got && !opts.only.includes("email") && r.contact_pref !== "none" && (await sendEmail(r, url))) {
        email++;
        got = true;
      }
      if (got) reached++;
      record();
      continue;
    }
    if ((await pushNow(r, p)) > 0) {
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
    record();
  }
  return { push, email, text, reached, ...(held ? { held } : {}) } as { push: number; email: number; text: number; reached: number; held?: number };
}

interface TextMeta {
  noReply: boolean;
  replyMemberId: number | null;
  replyPrivate: boolean;
  asMember: boolean;
}

/** After a text to a member went out (or they'd replied STOP): where their texted reply goes. */
function afterText(memberId: number, orgId: number, meta: TextMeta, res: string) {
  // A private reminder: a reply to it isn't passed on, and replies to earlier texts still go where they did.
  if (res === "sent" && meta.noReply) d().prepare("UPDATE members SET text_last_noreply = 1 WHERE id = ?").run(memberId);
  else if (res === "sent") {
    // Which organizations texted them lately (to ask which one a reply is for).
    d().prepare("INSERT INTO member_text_orgs (member_id, org_id) VALUES (?, ?) ON CONFLICT DO UPDATE SET at = datetime('now')").run(memberId, orgId);
    // A texted reply goes to this organization (and, after a member's message, to that member).
    d()
      .prepare("UPDATE members SET last_text_org_id = ?, text_reply_member_id = ?, text_reply_private = ?, text_as_member = ?, text_last_noreply = 0 WHERE id = ?")
      .run(orgId, meta.replyMemberId, meta.replyPrivate ? 1 : 0, meta.asMember ? 1 : 0, memberId);
  }
  // They replied STOP: stop texting them; use email if they have one.
  if (res === "opted_out")
    d().prepare("UPDATE members SET contact_pref = CASE WHEN email IS NOT NULL THEN 'email' ELSE 'none' END, always_text = 0, sms_consent_at = NULL WHERE id = ?").run(memberId);
}

/** Whether this member has a phone or browser to send app notifications to. */
function hasPushDevice(memberId: number): boolean {
  return !!d().prepare("SELECT 1 FROM push_subscriptions WHERE member_id = ? UNION SELECT 1 FROM native_push_tokens WHERE member_id = ?").get(memberId, memberId);
}

/** Sends the app notifications held overnight whose morning has come. Returns how many reached a device. */
export async function sendHeldPushes(now: Date = new Date()): Promise<number> {
  const rows = d().prepare("SELECT h.* FROM held_pushes h JOIN members m ON m.id = h.member_id WHERE h.send_at <= ? AND m.status = 'active' ORDER BY h.id LIMIT 500").all(now.toISOString()) as {
    id: number;
    member_id: number;
    payload: string;
  }[];
  let sent = 0;
  for (const h of rows) {
    d().prepare("DELETE FROM held_pushes WHERE id = ?").run(h.id);
    if ((await pushToMember(h.member_id, JSON.parse(h.payload) as PushPayload)) > 0) sent++;
  }
  d().prepare("DELETE FROM held_pushes WHERE send_at <= ? AND member_id NOT IN (SELECT id FROM members WHERE status = 'active')").run(now.toISOString());
  return sent;
}

/** Sends the texts held overnight whose morning has come (to people still taking texts). Returns how many went. */
export async function sendHeldTexts(now: Date = new Date()): Promise<number> {
  const rows = d().prepare("SELECT * FROM held_texts WHERE send_at <= ? ORDER BY id LIMIT 500").all(now.toISOString()) as {
    id: number;
    org_id: number;
    member_id: number;
    phone: string;
    body: string;
    no_reply: number;
    reply_member_id: number | null;
    reply_private: number;
    as_member: number;
  }[];
  let sent = 0;
  for (const h of rows) {
    d().prepare("DELETE FROM held_texts WHERE id = ?").run(h.id);
    // Still theirs, still agreeing to texts (no STOP overnight), and within the ward's limit.
    const ok = d().prepare("SELECT 1 FROM members WHERE id = ? AND phone = ? AND status = 'active' AND sms_consent_at IS NOT NULL").get(h.member_id, h.phone);
    if (!ok || !canSendNotice(h.org_id)) continue;
    const res = await sendSms(h.org_id, h.phone, h.body, "notice");
    afterText(h.member_id, h.org_id, { noReply: !!h.no_reply, replyMemberId: h.reply_member_id, replyPrivate: !!h.reply_private, asMember: !!h.as_member }, res);
    if (res === "sent") sent++;
  }
  return sent;
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

/**
 * Adds to the presidency's "Couldn't reach" list (Waiting on you): something sent to
 * a person that reached them by no means. The same thing again just moves to the top.
 */
export function noteUnreached(orgId: number, memberId: number | null, what: string, url: string, detail = "") {
  const d = db();
  const open = memberId
    ? (d.prepare("SELECT id FROM unreached WHERE org_id = ? AND member_id = ? AND url = ? AND done_at IS NULL").get(orgId, memberId, url) as { id: number } | undefined)
    : undefined;
  if (open) d.prepare("UPDATE unreached SET what = ?, detail = ?, created_at = datetime('now') WHERE id = ?").run(what.slice(0, 200), detail.slice(0, 1000), open.id);
  else d.prepare("INSERT INTO unreached (org_id, member_id, what, detail, url) VALUES (?, ?, ?, ?, ?)").run(orgId, memberId, what.slice(0, 200), detail.slice(0, 1000), url);
}
