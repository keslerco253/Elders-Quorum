import crypto from "crypto";
import { db } from "./db";
import { appUrl } from "./config";
import { normalizePhone } from "./contact";
import { receiveReply, recentMessageFor, recentReplies, threadForTextReply } from "./conversations";
import { sendSms, twilioConfigured } from "./sms";
import { closedText, orgTakesMessages } from "./message-routing";
import { confirmTeaching, declineTeaching, nextLessonTaughtBy } from "./teaching";
import { getOrg, getWard, homeOf, isSiteOwner, memberWards, orgFullName, orgLabel } from "./orgs";
import { textedItems } from "./photo-event";
import type { Member } from "./types";
import { allowHit } from "./rate-limit";
import { answerRequest, latestPendingRequest } from "./teaching-requests";
import { DateTime } from "luxon";
import { guestOptOut } from "./guest-signups";
import { alreadyJoined, alreadyJoinedReply, continueTextJoin, loginLink, endTextJoin, inTextJoin, JOIN_WORD, joinByText, joinConfirmation, startTextJoin } from "./text-join";

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
  | "asked_which"
  | "joined"
  | "photo_todo"
  | "leader_use_app";

/** Texted back (once a month) to a number that isn't anyone's in the app. */
/** Answer to a texted reply to one of their own private reminders (which isn't passed to anyone). */
export const PRIVATE_REMINDER_REPLY = "That was your private reminder, so your reply wasn't sent to anyone. To message your leaders, text again or use the app.";
export const UNKNOWN_NUMBER_REPLY =
  "My Ward Link: this number isn't connected to anyone in the app, so your message wasn't delivered. Text from the number your leaders have, or use the app.";

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

async function routeText(params: Record<string, string>, seen: Seen): Promise<InboundResult> {
  const from = normalizePhone(params.From || "");
  const body = (params.Body || "").trim();
  // The site owner texting things to remember: TODO (to-do list) or EVENT (calendar), in
  // words, with a picture, or both; a picture on its own is an event.
  const keyword = body.match(/^\s*(event|to[\s-]?do)\b[\s:,.-]*/i);
  const pictures = Number(params.NumMedia || 0);
  if (from && (keyword || pictures > 0)) {
    const owner = photoSender(from);
    if (owner) {
      const kind = keyword && /^to/i.test(keyword[1]) ? "todo" : keyword ? "event" : null;
      const note = keyword ? body.slice(keyword[0].length).trim() : body;
      const media = Array.from({ length: Math.min(pictures, 4) }, (_, i) => ({ url: params[`MediaUrl${i}`] || "", type: params[`MediaContentType${i}`] || "" })).filter((m) => m.url);
      seen.memberId = owner.id;
      seen.note = kind === "todo" ? "Texted a to-do" : "Texted a calendar event";
      if (kind && !note && !media.length) {
        // Just the word: ready for the picture (or the words) that come next.
        waiting.set(owner.id, { kind, until: Date.now() + 30 * 60_000 });
        seen.reply = kind === "todo" ? "Ready. Text what to do (a date if it has one), or send a picture." : "Ready. Send the picture (front and back is fine) and I'll put it on your calendar.";
        return "photo_todo";
      }
      // Only the first text of a batch is answered; the rest join it.
      if (collectTexted(owner, from, kind, media, note))
        seen.reply = `Got it. I'll text you when it's posted to your ${(kind ?? waitingKind(owner.id) ?? "event") === "todo" ? "to-dos" : "calendar"}.`;
      return "photo_todo";
    }
  }
  if (!from || !body) return "ignored";
  const row = db()
    .prepare(
      "SELECT id, last_text_org_id, display_name, text_reply_member_id, text_reply_private, text_as_member, text_last_noreply FROM members WHERE phone = ? AND status = 'active' ORDER BY last_login_at DESC LIMIT 1",
    )
    .get(from) as { id: number; last_text_org_id: number | null; display_name: string; text_reply_member_id: number | null; text_reply_private: number; text_as_member: number; text_last_noreply: number } | undefined;
  // Texts from numbers that aren't in the app aren't stored. STOP from someone who signed
  // up for service without an account ends texts to them.
  if (!row) {
    const word = body.toUpperCase().replace(/[^A-Z]/g, "");
    if ((params.OptOutType || "").toUpperCase() === "STOP" || STOP_WORDS.includes(word)) {
      endTextJoin(from);
      return guestOptOut(from) ? "opted_out" : "unknown_sender";
    }
    if ((params.OptOutType || "").toUpperCase() === "HELP" || SKIP_WORDS.includes(word)) return "unknown_sender";
    // JOIN (and maybe the ward's join code) from a number no one has added: they join by
    // text, answering a few questions (a few tries a day per number, and not too many at once).
    const join = body.match(/^\s*join\b[\s:,.-]*(.*)$/i);
    // A number whose account had its access turned off (or is waiting for approval) can't join again by text.
    const held = db().prepare("SELECT status FROM members WHERE phone = ? AND status <> 'active' ORDER BY status = 'inactive' DESC LIMIT 1").get(from) as { status: string } | undefined;
    if (held && (join || inTextJoin(from))) {
      endTextJoin(from);
      if (allowHit(`sms-join-held:${from}`, 1, 24 * 60))
        seen.reply = held.status === "pending" ? "My Ward Link: your request to join is waiting for approval. We'll let you know when it's approved." : "My Ward Link: this number's access was turned off. Please contact your ward leaders.";
      seen.note = "JOIN from a number whose access is off or waiting";
      return "unknown_sender";
    }
    if (join) {
      if (allowHit(`sms-join-start:${from}`, 5, 24 * 60) && allowHit("sms-join-all", 60, 60)) {
        seen.reply = startTextJoin(from, join[1]);
        seen.note = "Started joining by text";
      }
      return "unknown_sender";
    }
    if (inTextJoin(from)) {
      seen.reply = continueTextJoin(from, body);
      // Their account is made with the last answer.
      const made = db().prepare("SELECT id FROM members WHERE phone = ? AND status = 'active' LIMIT 1").get(from) as { id: number } | undefined;
      if (made) {
        seen.memberId = made.id;
        seen.note = "Joined by text";
        return "joined";
      }
      seen.note = "Joining by text";
      return "unknown_sender";
    }
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
  // JOIN: a member a leader added agrees to ward texts (and START, after a STOP, agrees
  // again; Twilio answers START itself).
  // "JOIN VILLAS" (from a texting card with the join code) is JOIN too.
  const isJoin = word === JOIN_WORD || /^\s*join\b/i.test(body);
  // JOIN from someone already signed up for texts: nothing changes; they're told which
  // account it is and where to sign in.
  if (isJoin && optOut !== "START") {
    const already = alreadyJoined(from);
    if (already.length) {
      seen.reply = alreadyJoinedReply(from, already, getWard(getOrg(orgId)?.ward_id ?? 0)?.name ?? "My Ward Link");
      seen.note = "JOIN from someone already signed up";
      return "ignored";
    }
  }
  if (isJoin || optOut === "START" || word === "START" || word === "UNSTOP") {
    joinByText(from);
    seen.note = "joined by text";
    if (word.startsWith(JOIN_WORD)) seen.reply = `${joinConfirmation(getWard(getOrg(orgId)?.ward_id ?? 0)?.name ?? "My Ward Link")} App: ${loginLink(from)}`;
    return "joined";
  }
  if (optOut === "HELP" || optOut === "START" || SKIP_WORDS.includes(word)) return "ignored";
  // A reply right after one of their private reminders (a to-do or their own event) is
  // kept to themselves: it isn't passed to anyone. Their next text goes where it would have.
  if (row.text_last_noreply) {
    db().prepare("UPDATE members SET text_last_noreply = 0 WHERE id = ?").run(row.id);
    seen.reply = PRIVATE_REMINDER_REPLY;
    seen.note = "Reply to a private reminder (not passed on)";
    return "ignored";
  }

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
  // A leader texting back to answer a member isn't sent on (it could reach the wrong
  // person, like someone who wrote long ago): answers to members go through the app.
  if (leader) {
    db().prepare("DELETE FROM sms_pending WHERE leader_id = ?").run(row.id);
    const to = row.text_reply_member_id;
    seen.reply = `My Ward Link: texted replies to members aren't sent. Please answer in the app: ${appUrl()}${to ? `/admin/replies/${to}?org=${orgId}${row.text_reply_private ? "&private=1" : ""}#end` : "/messages"}`;
    seen.note = "A leader's texted reply (not sent: answer in the app)";
    return "leader_use_app";
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
    // Organizations in different wards are named with their ward ("Villas Ward Elders Quorum").
    const wardsAsked = new Set(options.map((id) => getOrg(id)?.ward_id)).size > 1;
    const name = (id: number) => (wardsAsked ? orgFullName(id) : orgLabel(getOrg(id)!));
    const names = options.map((id, i) => `${i + 1} for ${name(id)}`);
    seen.reply = `Which is your message for? Reply ${names.length > 2 ? names.slice(0, -1).join(", ") + ", or " + names.at(-1) : names.join(" or ")}.`;
    seen.note = `Asked which organization (${options.map(name).join(", ")})`;
    return "asked_which";
  }
  // In more than one ward, and no one texted them lately: ask which ward it's for (each
  // ward's organization they belong to, else the ward itself).
  if (!lately.length) {
    const wards = memberWards(member.id);
    if (wards.length > 1) {
      const options = wards.slice(0, 3).map((w) => {
        const own = db()
          .prepare(
            `SELECT o.id FROM org_members om JOIN orgs o ON o.id = om.org_id WHERE om.member_id = ? AND o.ward_id = ? AND o.active = 1
             ORDER BY o.id = ? DESC, om.role = 'presidency' DESC, (o.kind = 'group' AND om.official = 1) DESC, o.kind = 'ward' DESC LIMIT 1`,
          )
          .get(member.id, w.id, orgId) as { id: number } | undefined;
        return own?.id ?? (db().prepare("SELECT id FROM orgs WHERE ward_id = ? AND kind = 'ward'").get(w.id) as { id: number }).id;
      });
      db().prepare("INSERT OR REPLACE INTO sms_member_pending (member_id, body, options) VALUES (?, ?, ?)").run(member.id, body, JSON.stringify(options));
      const names = options.map((id, i) => `${i + 1} for ${orgFullName(id)}`);
      seen.reply = `Which ward is your message for? Reply ${names.length > 2 ? names.slice(0, -1).join(", ") + ", or " + names.at(-1) : names.join(" or ")}.`;
      seen.note = `Asked which ward (${wards.map((w) => w.name).join(", ")})`;
      return "asked_which";
    }
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

/** The site owner, by the phone a picture came from (only they can text pictures in). */
function photoSender(phone: string): { id: number; orgId: number | null } | null {
  const rows = db().prepare("SELECT * FROM members WHERE phone = ? AND status = 'active'").all(phone) as Member[];
  const owner = rows.find((m) => isSiteOwner(m));
  return owner ? { id: owner.id, orgId: homeOf(owner.id).orgId } : null;
}

/** EVENT or TODO on its own: what the next picture or words are for (half an hour). */
const waiting = new Map<number, { kind: "event" | "todo"; until: number }>();
const waitingKind = (memberId: number) => {
  const w = waiting.get(memberId);
  return w && w.until > Date.now() ? w.kind : null;
};
/**
 * What the owner texted in, gathered for a moment: a phone sends a note and its picture,
 * or the front and back, as separate texts. Read together once no more come.
 */
const batches = new Map<number, { kind: "event" | "todo" | null; media: { url: string; type: string }[]; notes: string[]; timer: ReturnType<typeof setTimeout> }>();
/** How long to wait for more pictures or words before reading them. */
export const PICTURE_WAIT_MS = 15_000;

/** Adds a text to this owner's batch. True for the batch's first. */
function collectTexted(owner: { id: number; orgId: number | null }, phone: string, kind: "event" | "todo" | null, media: { url: string; type: string }[], note: string): boolean {
  const old = batches.get(owner.id);
  if (old) clearTimeout(old.timer);
  const batch = old ?? { kind: null, media: [], notes: [], timer: setTimeout(() => {}, 0) };
  batch.kind ??= kind;
  batch.media.push(...media);
  if (note.trim()) batch.notes.push(note.trim());
  batch.timer = setTimeout(() => {
    batches.delete(owner.id);
    const as = batch.kind ?? waitingKind(owner.id) ?? "event";
    waiting.delete(owner.id);
    void textedItems(owner.id, as, batch.media, batch.notes.join(" "))
      .then((reply) => sendSms(owner.orgId, phone, reply, "notice"))
      .catch((err) => console.error("[sms] texted item failed", err));
  }, PICTURE_WAIT_MS);
  batches.set(owner.id, batch);
  return !old;
}
