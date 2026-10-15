import crypto from "crypto";
import { db } from "./db";
import { appUrl } from "./config";
import { normalizePhone } from "./contact";
import { receiveReply, recentMessageFor, recentReplies, sendAnswer, threadForTextReply } from "./conversations";
import { twilioConfigured } from "./sms";
import { confirmTeaching, declineTeaching, nextLessonTaughtBy } from "./teaching";
import { getOrg, getWard, homeOf } from "./orgs";
import { answerRequest, latestPendingRequest } from "./teaching-requests";
import { DateTime } from "luxon";

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
  | "request_taken";

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

/** `waiting`: nobody in the presidency has answered them since their latest message. */
type Writer = { memberId: number; private: boolean; at: string; waiting: boolean };

/** Members who wrote to this leader (privately, or to their whole presidency) recently, newest first, once each. */
function recentWriters(leaderId: number, orgId: number, since = "-3 days"): Writer[] {
  const rows = db()
    .prepare(
      `SELECT m.member_id, m.recipient_id, m.created_at,
         NOT EXISTS (SELECT 1 FROM member_messages o WHERE o.org_id = m.org_id AND o.member_id = m.member_id AND o.direction = 'out' AND o.id > m.id) AS waiting
       FROM member_messages m
       WHERE m.org_id = ? AND m.direction = 'in' AND m.member_id <> ? AND (m.recipient_id = ? OR m.recipient_id IS NULL) AND m.created_at > datetime('now', ?)
       ORDER BY m.id DESC`,
    )
    .all(orgId, leaderId, leaderId, since) as { member_id: number; recipient_id: number | null; created_at: string; waiting: number }[];
  const seen = new Set<number>();
  return rows.flatMap((r) =>
    seen.has(r.member_id) ? [] : (seen.add(r.member_id), [{ memberId: r.member_id, private: r.recipient_id !== null, at: r.created_at, waiting: !!r.waiting }]),
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
      "SELECT id, last_text_org_id, display_name, text_reply_member_id, text_reply_private FROM members WHERE phone = ? AND status = 'active' ORDER BY last_login_at DESC LIMIT 1",
    )
    .get(from) as { id: number; last_text_org_id: number | null; display_name: string; text_reply_member_id: number | null; text_reply_private: number } | undefined;
  // Texts from numbers that aren't in the app aren't stored.
  if (!row) return "unknown_sender";
  seen.memberId = row.id;
  // A reply goes to the organization that last texted them.
  const orgId = row.last_text_org_id ?? homeOf(row.id).orgId;
  if (!orgId) return "unknown_sender";
  const member = { id: row.id, org_id: orgId, display_name: row.display_name };

  const word = body.toUpperCase().replace(/[^A-Z]/g, "");
  const optOut = (params.OptOutType || "").toUpperCase();
  if (optOut === "STOP" || STOP_WORDS.includes(word)) {
    db().prepare("UPDATE members SET contact_pref = CASE WHEN email IS NOT NULL THEN 'email' ELSE 'none' END WHERE id = ? AND contact_pref IN ('text','both')").run(member.id);
    // Replying STOP withdraws their consent; they can agree again under Contact & notifications.
    db().prepare("UPDATE members SET always_text = 0, sms_consent_at = NULL WHERE id = ?").run(member.id);
    return "opted_out";
  }
  if (optOut === "HELP" || optOut === "START" || SKIP_WORDS.includes(word)) return "ignored";

  if (twilioConfigured()) db().prepare("INSERT INTO sms_log (org_id, kind) VALUES (?, 'reply')").run(member.org_id);

  const leader = !!db().prepare("SELECT 1 FROM org_members WHERE org_id = ? AND member_id = ? AND role = 'presidency'").get(orgId, row.id);
  const answer = async (to: { memberId: number; private: boolean }, text = body) => {
    if (!(await sendAnswer(member, to.memberId, text, to.private))) return false;
    seen.note = `Answer to ${nameOf(to.memberId)}${to.private ? " (private)" : ""}`;
    return true;
  };
  /**
   * Sends a leader's reply to `target`, unless it's unclear who it's for: then it's
   * held and the leader is asked. Unclear means two or more people who wrote in the
   * last 3 days are still waiting for an answer, or someone's message arrived just
   * before the reply while someone else wrote in the last 15 minutes (the leader may
   * have been answering someone else).
   */
  /** Holds the reply and asks the leader who it's for (up to 6 people, to keep the text short). */
  const askWho = (people: Writer[], text: string): InboundResult => {
    const options = people.slice(0, 6);
    db().prepare("INSERT OR REPLACE INTO sms_pending (leader_id, org_id, body, options) VALUES (?, ?, ?, ?)").run(row.id, orgId, text, JSON.stringify(options));
    const names = options.map((o, i) => `${i + 1} for ${nameOf(o.memberId)}`);
    seen.reply = `Who is this for? Reply ${names.length > 2 ? names.slice(0, -1).join(", ") + ", or " + names.at(-1) : names.join(" or ")}.`;
    seen.note = `Asked who it's for (${options.map((o) => nameOf(o.memberId)).join(", ")})`;
    return "asked_who";
  };
  const answerOrAsk = async (target: { memberId: number; private: boolean }): Promise<InboundResult | null> => {
    const writers = recentWriters(row.id, orgId);
    const recent = writers.filter((w) => ago(w.at) < ACTIVE_MINUTES * 60);
    const waiting = writers.filter((w) => w.waiting);
    const justArrived = recent.length > 1 && ago(recent[0].at) < JUST_ARRIVED_SECONDS;
    if (waiting.length > 1 || justArrived) {
      // Everyone still waiting, plus (after a just-arrived message) whoever wrote in the last
      // 15 minutes. Newest first.
      return askWho(writers.filter((w) => w.waiting || (justArrived && recent.includes(w))), body);
    }
    // One person still waiting: that's who it's for.
    return (await answer(waiting.length === 1 ? waiting[0] : target)) ? "answer_sent" : null;
  };

  if (leader) {
    // Answering "Who is this for?": the number picks the person, and the held reply goes to them.
    const pending = db().prepare("SELECT body, options FROM sms_pending WHERE leader_id = ? AND created_at > datetime('now', '-15 minutes')").get(row.id) as
      | { body: string; options: string }
      | undefined;
    db().prepare("DELETE FROM sms_pending WHERE leader_id = ?").run(row.id);
    const pick = body.match(/^\s*(\d)\s*[.)]?\s*$/);
    if (pending && pick) {
      const choice = (JSON.parse(pending.options) as Writer[])[Number(pick[1]) - 1];
      if (choice && (await answer(choice, pending.body))) return "answer_sent";
    }
    // "Hyrum, see you at 7" (or "Hyrum: ...") goes to that person, whoever wrote last. Only the
    // name of someone who wrote to them counts, so "Sure, ..." is just a reply.
    const named = body.match(/^\s*([^:,\n]{2,40})([:,])\s*([\s\S]+)$/);
    if (named) {
      const wanted = named[1].trim().toLowerCase();
      // With a comma the name reads as part of the message ("Hyrum, see you at 7"), so it's kept.
      const text = named[2] === "," ? body.trim() : named[3].trim();
      const matches = recentWriters(row.id, orgId, "-14 days").filter((w) => {
        const name = nameOf(w.memberId).toLowerCase();
        return name === wanted || name.split(/\s+/)[0] === wanted;
      });
      if (matches.length === 1 && (await answer(matches[0], text))) return "answer_sent";
      // Two people with that name (e.g. two Hyrums): ask which one.
      if (matches.length > 1) return askWho(matches, text);
    }
    // A leader answering the member's message the app just texted them.
    if (row.text_reply_member_id) {
      const r = await answerOrAsk({ memberId: row.text_reply_member_id, private: !!row.text_reply_private });
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
  const latest = leader ? recentWriters(row.id, orgId)[0] : undefined;
  if (latest) {
    const r = await answerOrAsk(latest);
    if (r) return r;
  }
  if (recentReplies(member.id) >= 20) return "ignored";
  const thread = threadForTextReply(member.id, orgId);
  await receiveReply(member, body, "text", recentMessageFor(member.id, orgId), thread);
  seen.note = thread.private ? `Private message to ${nameOf(thread.withId)}` : "Message to the presidency";
  return "saved";
}
