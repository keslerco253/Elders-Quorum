import crypto from "crypto";
import { db } from "./db";
import { appUrl } from "./config";
import { normalizePhone } from "./contact";
import { receiveReply, recentMessageFor, recentReplies, threadForTextReply } from "./conversations";
import { twilioConfigured } from "./sms";
import { confirmTeaching, declineTeaching, nextLessonTaughtBy } from "./teaching";
import { getWard } from "./wards";
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
export async function handleInboundText(params: Record<string, string>): Promise<InboundResult> {
  const from = normalizePhone(params.From || "");
  const body = (params.Body || "").trim();
  if (!from || !body) return "ignored";
  const member = db()
    .prepare("SELECT id, ward_id, display_name FROM members WHERE phone = ? AND status = 'active' ORDER BY last_login_at DESC LIMIT 1")
    .get(from) as { id: number; ward_id: number; display_name: string } | undefined;
  // Texts from numbers that aren't in the app aren't stored.
  if (!member) return "unknown_sender";

  const word = body.toUpperCase().replace(/[^A-Z]/g, "");
  const optOut = (params.OptOutType || "").toUpperCase();
  if (optOut === "STOP" || STOP_WORDS.includes(word)) {
    db().prepare("UPDATE members SET contact_pref = CASE WHEN email IS NOT NULL THEN 'email' ELSE 'none' END WHERE id = ? AND contact_pref IN ('text','both')").run(member.id);
    // Replying STOP withdraws their consent; they can agree again under Contact & notifications.
    db().prepare("UPDATE members SET always_text = 0, sms_consent_at = NULL WHERE id = ?").run(member.id);
    return "opted_out";
  }
  if (optOut === "HELP" || optOut === "START" || SKIP_WORDS.includes(word)) return "ignored";

  if (twilioConfigured()) db().prepare("INSERT INTO sms_log (ward_id, kind) VALUES (?, 'reply')").run(member.ward_id);

  const teach = parseTeachReply(body);
  const tz = getWard(member.ward_id)?.timezone ?? "America/Boise";
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
  if (recentReplies(member.id) >= 20) return "ignored";
  await receiveReply(member, body, "text", recentMessageFor(member.id), threadForTextReply(member.id));
  return "saved";
}
