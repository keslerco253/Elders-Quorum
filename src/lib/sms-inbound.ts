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
  answer_sent: "Sent. Your answer is also in their conversation in the app.",
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
export async function handleInboundText(params: Record<string, string>): Promise<InboundResult> {
  const seen: Seen = { memberId: null, note: "" };
  const result = await routeText(params, seen);
  // The site owner's log of incoming texts (who, and where it went; not the words).
  db().prepare("DELETE FROM sms_inbound_log WHERE created_at < datetime('now', '-30 days')").run();
  db().prepare("INSERT INTO sms_inbound_log (member_id, result, note) VALUES (?, ?, ?)").run(seen.memberId, result, seen.note);
  return result;
}

type Seen = { memberId: number | null; note: string };

/** The newest message a member sent this leader (privately, or to their whole presidency) in the last few days. */
function latestMessageTo(leaderId: number, orgId: number): { memberId: number; private: boolean } | null {
  const r = db()
    .prepare(
      `SELECT member_id, recipient_id FROM member_messages
       WHERE org_id = ? AND direction = 'in' AND member_id <> ? AND (recipient_id = ? OR recipient_id IS NULL) AND created_at > datetime('now', '-3 days')
       ORDER BY id DESC LIMIT 1`,
    )
    .get(orgId, leaderId, leaderId) as { member_id: number; recipient_id: number | null } | undefined;
  return r ? { memberId: r.member_id, private: r.recipient_id !== null } : null;
}

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
  const answer = async (to: { memberId: number; private: boolean }) => {
    if (!(await sendAnswer(member, to.memberId, body, to.private))) return false;
    seen.note = `Answer to ${nameOf(to.memberId)}${to.private ? " (private)" : ""}`;
    return true;
  };
  // A leader answering the member's message the app just texted them.
  if (leader && row.text_reply_member_id && (await answer({ memberId: row.text_reply_member_id, private: !!row.text_reply_private }))) return "answer_sent";

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
  const latest = leader ? latestMessageTo(row.id, orgId) : null;
  if (latest && (await answer(latest))) return "answer_sent";
  if (recentReplies(member.id) >= 20) return "ignored";
  const thread = threadForTextReply(member.id, orgId);
  await receiveReply(member, body, "text", recentMessageFor(member.id, orgId), thread);
  seen.note = thread.private ? `Private message to ${nameOf(thread.withId)}` : "Message to the presidency";
  return "saved";
}
