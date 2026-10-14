import { db } from "./db";
import { audienceMembers, notify, recipientById } from "./notify";
import { signToken, validToken } from "./signed-links";
import { formatDate } from "./time";
import { inOrgWard } from "./orgs";
import { getOrg } from "./orgs";

// The presidency asks a member to teach; the member accepts (and is assigned
// as the teacher) or declines. Answers come from the app, a private link in
// the notification, push buttons, or a TEACH / CANT text.

export interface TeachingRequest {
  id: number;
  org_id: number;
  lesson_id: number;
  member_id: number;
  member_name: string;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  reason: string;
  asked_by_name: string | null;
  created_at: string;
  responded_at: string | null;
  lesson_date: string;
  lesson_title: string;
  lesson_speaker: string;
  lesson_teacher_id: number | null;
}

const SELECT = `SELECT r.*, m.display_name AS member_name, a.display_name AS asked_by_name,
    l.date AS lesson_date, l.title AS lesson_title, l.speaker AS lesson_speaker, l.teacher_id AS lesson_teacher_id
  FROM teaching_requests r JOIN members m ON m.id = r.member_id LEFT JOIN members a ON a.id = r.asked_by JOIN lessons l ON l.id = r.lesson_id`;

export const askToken = (requestId: number, memberId: number) => signToken(`ask:${requestId}:${memberId}`);
export const validAskToken = (requestId: number, memberId: number, token: string) => validToken(`ask:${requestId}:${memberId}`, token);
export const askPath = (r: { id: number; member_id: number }, answer?: "accept" | "decline") => `/ask/${r.id}?t=${askToken(r.id, r.member_id)}${answer ? `&a=${answer}` : ""}`;

export function getRequest(id: number): TeachingRequest | undefined {
  return db().prepare(`${SELECT} WHERE r.id = ?`).get(id) as TeachingRequest | undefined;
}

export function requestsForLesson(lessonId: number): TeachingRequest[] {
  return db().prepare(`${SELECT} WHERE r.lesson_id = ? ORDER BY r.id DESC`).all(lessonId) as TeachingRequest[];
}

/** Requests waiting for this member's answer, soonest lesson first. */
export function pendingRequestsFor(memberId: number, today: string): TeachingRequest[] {
  return db().prepare(`${SELECT} WHERE r.member_id = ? AND r.status = 'pending' AND l.date >= ? ORDER BY l.date`).all(memberId, today) as TeachingRequest[];
}

const lessonLabel = (r: Pick<TeachingRequest, "lesson_date" | "lesson_title" | "lesson_speaker">) =>
  `${formatDate(r.lesson_date, "short")}${r.lesson_title ? ` ("${r.lesson_title}"${r.lesson_speaker ? ` by ${r.lesson_speaker}` : ""})` : ""}`;

/** Sends the request. Returns an error message, or null when sent. */
export async function askToTeach(asker: { id: number; org_id: number; display_name: string }, lessonId: number, memberId: number, message: string, today: string) {
  const d = db();
  const lesson = d.prepare("SELECT id, date, kind, teacher_id FROM lessons WHERE id = ? AND org_id = ?").get(lessonId, asker.org_id) as
    | { id: number; date: string; kind: string; teacher_id: number | null }
    | undefined;
  if (!lesson || lesson.kind !== "talk") return "That lesson can't have a teacher.";
  if (lesson.date < today) return "That lesson has already happened.";
  const member = inOrgWard(memberId, asker.org_id) ? recipientById(memberId, asker.org_id) : undefined;
  if (!member) return "Choose a current member.";
  if (lesson.teacher_id === memberId) return `${member.display_name} is already the teacher.`;
  if (d.prepare("SELECT 1 FROM teaching_requests WHERE lesson_id = ? AND member_id = ? AND status = 'pending'").get(lessonId, memberId)) return `${member.display_name} was already asked and hasn't answered yet.`;
  const id = Number(
    d.prepare("INSERT INTO teaching_requests (org_id, lesson_id, member_id, message, asked_by) VALUES (?, ?, ?, ?, ?)").run(asker.org_id, lessonId, memberId, message.trim().slice(0, 500), asker.id)
      .lastInsertRowid,
  );
  const r = getRequest(id)!;
  const note = r.message ? ` "${r.message}"` : "";
  await notify([member], {
    title: `Will you teach on ${formatDate(r.lesson_date, "short")}?`,
    body: `${asker.display_name} asked if you'd teach in ${getOrg(asker.org_id)?.name ?? "your class"} on ${lessonLabel(r)}.${note} Tap to answer.`,
    url: askPath(r),
    linkLabel: "Answer",
    textBody: `${asker.display_name} asked if you'd teach in ${getOrg(asker.org_id)?.name ?? "your class"} on ${lessonLabel(r)}.${note} Reply TEACH to accept, or CANT and a reason.`,
    actions: [
      { action: "accept", title: "Yes, I'll teach", url: askPath(r, "accept") },
      { action: "decline", title: "I can't", url: askPath(r, "decline") },
    ],
  });
  return null;
}

export type AnswerResult = "accepted" | "declined" | "taken" | "closed";

/** The member's answer. Accepting assigns them (already confirmed); declining keeps their reason for the presidency. */
export async function answerRequest(requestId: number, memberId: number, accept: boolean, reason = ""): Promise<AnswerResult> {
  const d = db();
  const r = getRequest(requestId);
  if (!r || r.member_id !== memberId || r.status !== "pending") return "closed";
  if (accept && r.lesson_teacher_id && r.lesson_teacher_id !== memberId) {
    d.prepare("UPDATE teaching_requests SET status = 'cancelled', responded_at = datetime('now') WHERE id = ?").run(r.id);
    return "taken";
  }
  const why = reason.trim().slice(0, 500);
  d.transaction(() => {
    d.prepare("UPDATE teaching_requests SET status = ?, reason = ?, responded_at = datetime('now') WHERE id = ?").run(accept ? "accepted" : "declined", accept ? "" : why, r.id);
    if (accept) {
      d.prepare("UPDATE lessons SET teacher_id = ?, teacher_confirmed_at = datetime('now') WHERE id = ?").run(memberId, r.lesson_id);
      // Anyone else asked for this lesson no longer needs to answer.
      d.prepare("UPDATE teaching_requests SET status = 'cancelled' WHERE lesson_id = ? AND status = 'pending' AND id != ?").run(r.lesson_id, r.id);
    }
  })();
  await notify(audienceMembers(r.org_id, "presidency"), {
    title: accept ? "Teacher found" : "Can't teach",
    body: accept ? `${r.member_name} will teach on ${lessonLabel(r)}.` : `${r.member_name} can't teach on ${lessonLabel(r)}.${why ? ` Reason: ${why}` : ""}`,
    url: `/admin/lessons/${r.lesson_id}`,
  });
  return accept ? "accepted" : "declined";
}

export function cancelRequest(orgId: number, requestId: number) {
  return db().prepare("UPDATE teaching_requests SET status = 'cancelled', responded_at = datetime('now') WHERE id = ? AND org_id = ? AND status = 'pending'").run(requestId, orgId).changes > 0;
}

/** The newest request still waiting on this member (for TEACH / CANT text replies). */
export function latestPendingRequest(memberId: number, today: string) {
  return db()
    .prepare("SELECT r.id FROM teaching_requests r JOIN lessons l ON l.id = r.lesson_id WHERE r.member_id = ? AND r.status = 'pending' AND l.date >= ? ORDER BY r.id DESC LIMIT 1")
    .get(memberId, today) as { id: number } | undefined;
}
