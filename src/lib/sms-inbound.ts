import crypto from "crypto";
import { db } from "./db";
import { appUrl } from "./config";
import { normalizePhone } from "./contact";
import { receiveReply, recentMessageFor, recentReplies, sendAnswer, threadForTextReply } from "./conversations";
import { sendSms, twilioConfigured } from "./sms";
import { closedText, orgTakesMessages } from "./message-routing";
import { confirmTeaching, declineTeaching, nextLessonTaughtBy } from "./teaching";
import { getOrg, getWard, homeOf, orgFullName, orgLabel } from "./orgs";
import { allowHit } from "./rate-limit";
import { answerRequest, latestPendingRequest } from "./teaching-requests";
import { DateTime } from "luxon";
import { guestOptOut } from "./guest-signups";

/** The address set as "A message comes in" in Twilio. */
export const inboundUrl = () => process.env.TWILIO_WEBHOOK_URL || `${appUrl()}/api/sms/inbound`;

/** Checks X-Twilio-Signature: HMAC-SHA1 of the URL plus every posted field, sorted by name. */
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string, token: string) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", token).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"];
const SKIP_WORDS = ["HELP", "INFO", "START", "UNSTOP"];

export type InboundResult =
  | "saved"
  | "answer_sent"
  | "asked_who"
  | "opted_out"
  | "ignored"
  | "unknown_sender"
  | "teacher_confirmed"
  | "teacher_declined"
  | "request_accepted"
  | "request_declined"
  | "request_taken"
  | "asked_which";

/** Texted back (once a month) to a number that isn't anyone's in the app. */
export const UNKNOWN_NUMBER_REPLY =
  "My Ward Link: this phone number isn't connected to anyone in the app, so your message wasn't delivered. Please text from the number your ward leaders have for you, or message them in the app.";

/** What the app texts back after a teacher's TEACH / CANT reply. */
export const AUTO_REPLIES: Partial<Record<InboundResult, string>> = {
  teacher_confirmed: "Thanks! You're confirmed to teach. See you Sunday.",
  teacher_declined: "Thanks for letting us know. The presidency will find another teacher.",
  request_accepted: "Thank you! You're down to teach. You can add notes on the lesson page.",
  request_declined: "Thanks for letting us know. The presidency has your answer.",
  request_taken: "Thanks! Someone else is already teaching that lesson.",
};

/** "TEACH" / "teaching" confirms; "CANT ...", "can't, out of town", "cannot ..." declines with a reason. */
export function parseTeachReply(body: string): { answer: "teach" } | { answer: "cant"; reason: string } | null {
  if (/^\s*teach(ing)?\b/i.test(body)) return { answer: "teach" };
  const m = body.match(/^\s*(can['’]?t|cannot|can not)\b[\s,.:;!-]*([\s\S]*)$/i);
  return m ? { answer: "cant", reason: m[2].trim() } : null;
}

/**
 * Handles a text a member sent to the app's number. STOP and HELP are answered
 * by Twilio itself; anything else is saved as a reply to the presidency.
 */
export async function handleInboundText(params: Record<string, string>, out: { reply?: string } = {}): Promise<InboundResult> {
  const seen: Seen = { memberId: null, note: "", reply: undefined };
  const result = await routeText(params, seen);
  // The site owner's log of incoming texts (who, and where it went; not the words).
  db().prepare("DELETE FROM sms_inbound_log WHERE created_at < datetime('now', '-30 days')").run();
  db().prepare("INSERT INTO sms_inbound_log (member_id, result, note) VALUES (?, ?, ?)").run(seen.memberId, result, seen.note);
  out.reply = seen.reply;
  return result;
}

type Seen = { memberId: number | null; note: string; reply: string | undefined };

/** Someone who wrote to a leader, in one of the organizations they lead. `waiting`: nobody in that presidency has answered them since. */
type Writer = { memberId: number; orgId: number; private: boolean; at: string; waiting: boolean };

/**
 * Members who wrote to this leader (privately, or to the whole presidency) recently, in
 * any of the given organizations (every ward and organization they lead), newest first,
 * once each.
 */
function recentWriters(leaderId: number, orgIds: number[], since = "-3 days"): Writer[] {
  if (!orgIds.length) return [];
  const rows = db()
    .prepare(
      `SELECT m.member_id, m.org_id, m.recipient_id, m.created_at,
         NOT EXISTS (SELECT 1 FROM member_messages o WHERE o.org_id = m.org_id AND o.member_id = m.member_id AND o.direction = 'out' AND o.id > m.id) AS waiting
       FROM member_messages m
       WHERE m.org_id IN (${orgIds.map(() => "?").join(",")}) AND m.direction = 'in' AND m.member_id <> ? AND (m.recipient_id = ? OR m.recipient_id IS NULL)
         AND m.created_at > datetime('now', ?)
       ORDER BY m.id DESC`,
    )
    .all(...orgIds, leaderId, leaderId, since) as { member_id: number; org_id: number; recipient_id: number | null; created_at: string; waiting: number }[];
  const seen = new Set<number>();
  return rows.flatMap((r) =>
    seen.has(r.member_id)
      ? []
      : (seen.add(r.member_id), [{ memberId: r.member_id, orgId: r.org_id, private: r.recipient_id !== null, at: r.created_at, waiting: !!r.waiting }]),
  );
}

/** How long a new message counts as "just arrived" (the leader may not have seen it before replying). */
export const JUST_ARRIVED_SECONDS = 120;
/** People who wrote within this long are people the leader may be answering. */
const ACTIVE_MINUTES = 15;

const ago = (sqliteTime: string) => (Date.now() - Date.parse(sqliteTime.replace(" ", "T") + "Z")) / 1000;

const nameOf = (id: number) => (db().prepare("SELECT display_name FROM members WHERE id = ?").get(id) as { display_name: string } | undefined)?.display_name ?? "a member";

async function routeText(params: Record<string, string>, seen: Seen): Promise<InboundResult> {
  const from = normalizePhone(params.From || "");
  const body = (params.Body || "").trim();
  if (!from || !body) return "ignored";
  const row = db()
    .prepare(
      "SELECT id, last_text_org_id, display_name, text_reply_member_id, text_reply_private, text_as_member FROM members WHERE phone = ? AND status = 'active' ORDER BY last_login_at DESC LIMIT 1",
    )
    .get(from) as { id: number; last_text_org_id: number | null; display_name: string; text_reply_member_id: number | null; text_reply_private: number; text_as_member: number } | undefined;
  // Texts from numbers that aren't in the app aren't stored. STOP from someone who signed
  // up for service without an account ends texts to them.
  if (!row) {
    const word = body.toUpperCase().replace(/[^A-Z]/g, "");
    if ((params.OptOutType || "").toUpperCase() === "STOP" || STOP_WORDS.includes(word)) return guestOptOut(from) ? "opted_out" : "unknown_sender";
    if ((params.OptOutType || "").toUpperCase() === "HELP" || SKIP_WORDS.includes(word)) return "unknown_sender";
    // Let them know it wasn't delivered (once a month per number, so it can't run up texts).
    if (allowHit(`sms-unknown:${from}`, 1, 30 * 24 * 60)) seen.reply = UNKNOWN_NUMBER_REPLY;
    return "unknown_sender";
  }
  seen.memberId = row.id;
  // A reply goes to the organization that last texted them.
  const orgId = row.last_text_org_id ?? homeOf(row.id).orgId;
  if (!orgId) return "unknown_sender";
  const member = { id: row.id, org_id: orgId, display_name: row.display_name };

  const word = body.toUpperCase().replace(/[^A-Z]/g, "");
  const optOut = (params.OptOutType || "").toUpperCase();
  if (optOut === "STOP" || STOP_WORDS.includes(word)) {
    // Everyone on that number (it ends texts to the phone, not one account).
    db().prepare("UPDATE members SET contact_pref = CASE WHEN email IS NOT NULL THEN 'email' ELSE 'none' END WHERE phone = ? AND contact_pref IN ('text','both')").run(from);
    // Replying STOP withdraws their consent; they can agree again under Contact & notifications.
    db().prepare("UPDATE members SET always_text = 0, sms_consent_at = NULL WHERE phone = ?").run(from);
    guestOptOut(from);
    return "opted_out";
  }
  if (optOut === "HELP" || optOut === "START" || SKIP_WORDS.includes(word)) return "ignored";

  if (twilioConfigured()) db().prepare("INSERT INTO sms_log (org_id, kind) VALUES (?, 'reply')").run(member.org_id);

  // Every organization this person leads, in any ward: people waiting on them in any of
  // them are who a texted reply may be for.
  const ledOrgs = (
    db()
      .prepare("SELECT om.org_id FROM org_members om JOIN orgs o ON o.id = om.org_id WHERE om.member_id = ? AND om.role = 'presidency' AND o.active = 1")
      .all(row.id) as { org_id: number }[]
  ).map((r) => r.org_id);
  // A leader replying as a leader: the last text was from an organization they lead, or a member's message to them.
  // Not when the last text was to them as a member (a visit invitation, a personal message):
  // then it's their own reply to the presidency.
  const leader = !row.text_as_member && (ledOrgs.includes(orgId) || (ledOrgs.length > 0 && !!row.text_reply_member_id));
  const answer = async (to: { memberId: number; private: boolean; orgId: number }, text = body) => {
    // Answered from the organization the member wrote to.
    if (!ledOrgs.includes(to.orgId) || !(await sendAnswer({ ...member, org_id: to.orgId }, to.memberId, text, to.private))) return false;
    seen.note = `Answer to ${nameOf(to.memberId)}${to.private ? " (private)" : ""}${to.orgId !== orgId ? ` (${orgFullName(to.orgId)})` : ""}`;
    return true;
  };
  /** Holds the reply and asks the leader who it's for (up to 6 people, to keep the text short). */
  const askWho = (people: Writer[], text: string): InboundResult => {
    const options = people.slice(0, 6);
    db().prepare("INSERT OR REPLACE INTO sms_pending (leader_id, org_id, body, options) VALUES (?, ?, ?, ?)").run(row.id, orgId, text, JSON.stringify(options));
    // Two people with the same name in different wards or organizations: say which.
    const label = (o: Writer) => (options.some((x) => x !== o && nameOf(x.memberId) === nameOf(o.memberId)) ? `${nameOf(o.memberId)} (${orgFullName(o.orgId)})` : nameOf(o.memberId));
    const names = options.map((o, i) => `${i + 1} for ${label(o)}`);
    seen.reply = `Who is this for? Reply ${names.length > 2 ? names.slice(0, -1).join(", ") + ", or " + names.at(-1) : names.join(" or ")}.`;
    seen.note = `Asked who it's for (${options.map((o) => nameOf(o.memberId)).join(", ")})`;
    return "asked_who";
  };
  /**
   * Sends a leader's reply to `target`, unless it's unclear who it's for: then it's
   * held and the leader is asked. Unclear means two or more people who wrote in the
   * last 3 days are still waiting for an answer, or someone's message arrived just
   * before the reply while someone else wrote in the last 15 minutes (the leader may
   * have been answering someone else).
   */
  const answerOrAsk = async (target: { memberId: number; private: boolean; orgId: number }, named = false): Promise<InboundResult | null> => {
    const writers = recentWriters(row.id, ledOrgs);
    const recent = writers.filter((w) => ago(w.at) < ACTIVE_MINUTES * 60);
    const waiting = writers.filter((w) => w.waiting);
    const justArrived = recent.length > 1 && ago(recent[0].at) < JUST_ARRIVED_SECONDS;
    if (waiting.length > 1 || justArrived) {
      // Everyone still waiting, plus (after a just-arrived message) whoever wrote in the last
      // 15 minutes. Newest first.
      return askWho(writers.filter((w) => w.waiting || (justArrived && recent.includes(w))), body);
    }
    // The text they're answering named someone, but a different person is the one waiting: ask.
    const other = waiting.length === 1 && (waiting[0].memberId !== target.memberId || waiting[0].orgId !== target.orgId) ? waiting[0] : undefined;
    if (named && other) return askWho([{ ...target, at: "", waiting: false }, other], body);
    // One person still waiting: that's who it's for.
    return (await answer(other ?? target)) ? "answer_sent" : null;
  };

  if (leader) {
    // Answering "Who is this for?": the number picks the person, and the held reply goes to them.
    const pending = db().prepare("SELECT body, options FROM sms_pending WHERE leader_id = ? AND created_at > datetime('now', '-15 minutes')").get(row.id) as
      | { body: string; options: string }
      | undefined;
    db().prepare("DELETE FROM sms_pending WHERE leader_id = ?").run(row.id);
    const pick = body.match(/^\s*(\d)\s*[.)]?\s*$/);
    if (pending && pick) {
      const choice = (JSON.parse(pending.options) as Partial<Writer>[])[Number(pick[1]) - 1];
      if (choice?.memberId && (await answer({ memberId: choice.memberId, private: !!choice.private, orgId: choice.orgId ?? orgId }, pending.body))) return "answer_sent";
    }
    // "Hyrum, see you at 7" (or "Hyrum: ...") goes to that person, whoever wrote last. Only the
    // name of someone who wrote to them counts, so "Sure, ..." is just a reply.
    const named = body.match(/^\s*([^:,\n]{2,40})([:,])\s*([\s\S]+)$/);
    if (named) {
      const wanted = named[1].trim().toLowerCase();
      // With a comma the name reads as part of the message ("Hyrum, see you at 7"), so it's kept.
      const text = named[2] === "," ? body.trim() : named[3].trim();
      const matches = recentWriters(row.id, ledOrgs, "-14 days").filter((w) => {
        const name = nameOf(w.memberId).toLowerCase();
        return name === wanted || name.split(/\s+/)[0] === wanted;
      });
      if (matches.length === 1 && (await answer(matches[0], text))) return "answer_sent";
      // Two people with that name (e.g. two Hyrums): ask which one.
      if (matches.length > 1) return askWho(matches, text);
    }
    // A leader answering the member's message the app just texted them.
    if (row.text_reply_member_id) {
      // That message came from the organization that last texted them.
      const r = await answerOrAsk({ memberId: row.text_reply_member_id, private: !!row.text_reply_private, orgId }, true);
      if (r) return r;
    }
  }

  const teach = parseTeachReply(body);
  const tz = getWard(getOrg(member.org_id)?.ward_id ?? 0)?.timezone ?? "America/Boise";
  // Answering "Will you teach?" (a waiting request comes first).
  const request = teach ? latestPendingRequest(member.id, DateTime.now().setZone(tz).toISODate()!) : undefined;
  if (teach && request) {
    const result = await answerRequest(request.id, member.id, teach.answer === "teach", teach.answer === "cant" ? teach.reason : "");
    return result === "accepted" ? "request_accepted" : result === "taken" ? "request_taken" : "request_declined";
  }
  // A teacher answering their reminder.
  const lesson = teach ? nextLessonTaughtBy(member.id, tz) : undefined;
  if (teach && lesson) {
    if (teach.answer === "teach") {
      confirmTeaching(lesson.id, member.id);
      return "teacher_confirmed";
    }
    await declineTeaching(member, lesson, teach.reason);
    return "teacher_declined";
  }
  // Otherwise a leader's text answers the newest member message that came to them (from the last few days).
  const latest = leader ? recentWriters(row.id, ledOrgs)[0] : undefined;
  if (latest) {
    const r = await answerOrAsk(latest);
    if (r) return r;
  }
  if (recentReplies(member.id) >= 20) return "ignored";
  // Answering "Which is this for?": the held message goes where they say. Anything else:
  // the held message goes to whoever texted them last, and this one is handled as usual.
  const held = db().prepare("SELECT body, options FROM sms_member_pending WHERE member_id = ?").get(member.id) as { body: string; options: string } | undefined;
  if (held) {
    db().prepare("DELETE FROM sms_member_pending WHERE member_id = ?").run(member.id);
    const options = JSON.parse(held.options) as number[];
    const pick = body.match(/^\s*(\d)\s*[.)]?\s*$/);
    const chosen = pick ? options[Number(pick[1]) - 1] : undefined;
    if (chosen) {
      seen.note = await deliverTextReply(member, chosen, held.body);
      return "saved";
    }
    await deliverTextReply(member, options[0], held.body);
  }
  // Two or more organizations texted them in the last few days: ask which one this is for.
  const lately = orgsThatTextedLately(member.id);
  if (lately.length > 1) {
    const options = lately.slice(0, 3);
    db().prepare("INSERT OR REPLACE INTO sms_member_pending (member_id, body, options) VALUES (?, ?, ?)").run(member.id, body, JSON.stringify(options));
    const names = options.map((id, i) => `${i + 1} for ${orgLabel(getOrg(id)!)}`);
    seen.reply = `Which is your message for? Reply ${names.length > 2 ? names.slice(0, -1).join(", ") + ", or " + names.at(-1) : names.join(" or ")}.`;
    seen.note = `Asked which organization (${options.map((id) => orgLabel(getOrg(id)!)).join(", ")})`;
    return "asked_which";
  }
  seen.note = await deliverTextReply(member, orgId, body);
  return "saved";
}

/** Active organizations that texted this member in the last 3 days, newest first. */
function orgsThatTextedLately(memberId: number): number[] {
  return (
    db()
      .prepare(
        `SELECT t.org_id FROM member_text_orgs t JOIN orgs o ON o.id = t.org_id
         WHERE t.member_id = ? AND o.active = 1 AND t.at > datetime('now', '-3 days') ORDER BY t.at DESC`,
      )
      .all(memberId) as { org_id: number }[]
  ).map((r) => r.org_id);
}

/** Saves a member's texted reply in an organization (privately, if they were in a private conversation there). */
async function deliverTextReply(member: { id: number; display_name: string }, orgId: number, body: string) {
  // Leaders who don't take messages through the app: it isn't passed on, and the member is told (once a day).
  if (!orgTakesMessages(orgId, member.id)) {
    const phone = (db().prepare("SELECT phone FROM members WHERE id = ?").get(member.id) as { phone: string | null } | undefined)?.phone;
    if (phone && allowHit(`closed-reply:${member.id}:${orgId}`, 1, 24 * 60)) await sendSms(orgId, phone, `${closedText(getOrg(orgId)!)} Texts to this number aren't passed on.`, "notice");
    return `Not passed on: ${orgLabel(getOrg(orgId)!)} doesn't take messages`;
  }
  db().prepare("UPDATE members SET last_text_org_id = ? WHERE id = ?").run(orgId, member.id);
  const thread = threadForTextReply(member.id, orgId);
  const where = await receiveReply({ ...member, org_id: orgId }, body, "text", recentMessageFor(member.id, orgId), thread);
  return `Message to ${where}`;
}

/** Texted replies held while asking "Which is this for?" go to whoever texted last if there's no answer in 30 minutes. */
export async function deliverHeldReplies() {
  const held = db().prepare("SELECT member_id, body, options FROM sms_member_pending WHERE created_at < datetime('now', '-30 minutes')").all() as { member_id: number; body: string; options: string }[];
  for (const h of held) {
    db().prepare("DELETE FROM sms_member_pending WHERE member_id = ?").run(h.member_id);
    const member = db().prepare("SELECT id, display_name FROM members WHERE id = ?").get(h.member_id) as { id: number; display_name: string } | undefined;
    const [first] = JSON.parse(h.options) as number[];
    if (member && first) await deliverTextReply(member, first, h.body);
  }
}
