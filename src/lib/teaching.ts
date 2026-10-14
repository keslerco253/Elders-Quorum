import { DateTime } from "luxon";
import { db } from "./db";
import { signToken, validToken } from "./signed-links";
import { removeTeacherNotes } from "./lesson-notes";
import { audienceMembers, notify } from "./notify";
import { formatDate } from "./time";
import type { Lesson } from "./types";

// An assigned teacher can confirm they're still teaching or say they can't,
// from the lesson page, a reminder's buttons, its private link, or by text.

/** A private token for one teacher and one lesson, so a reminder's link works without signing in. */
export function teachToken(lessonId: number, teacherId: number) {
  return signToken(`teach:${lessonId}:${teacherId}`);
}

export function validTeachToken(lessonId: number, teacherId: number, token: string) {
  return validToken(`teach:${lessonId}:${teacherId}`, token);
}

/** The reply page for a teacher's reminder. */
export function respondPath(lessonId: number, teacherId: number, answer?: "teach" | "cant") {
  return `/teach/${lessonId}?t=${teachToken(lessonId, teacherId)}${answer ? `&a=${answer}` : ""}`;
}

type TeachLesson = Pick<Lesson, "id" | "org_id" | "date" | "title" | "teacher_id">;

export function lessonForTeacher(lessonId: number): (TeachLesson & { teacher_confirmed_at: string | null; kind: string }) | undefined {
  return db().prepare("SELECT id, org_id, date, title, kind, teacher_id, teacher_confirmed_at FROM lessons WHERE id = ?").get(lessonId) as
    | (TeachLesson & { teacher_confirmed_at: string | null; kind: string })
    | undefined;
}

/** The lesson this member is teaching in the next 8 days, if any (for text replies). */
export function nextLessonTaughtBy(memberId: number, tz: string) {
  const today = DateTime.now().setZone(tz).toISODate()!;
  const until = DateTime.now().setZone(tz).plus({ days: 8 }).toISODate()!;
  return db()
    .prepare("SELECT id, org_id, date, title, teacher_id FROM lessons WHERE teacher_id = ? AND kind = 'talk' AND date BETWEEN ? AND ? ORDER BY date LIMIT 1")
    .get(memberId, today, until) as TeachLesson | undefined;
}

export function confirmTeaching(lessonId: number, memberId: number) {
  return db().prepare("UPDATE lessons SET teacher_confirmed_at = coalesce(teacher_confirmed_at, datetime('now')) WHERE id = ? AND teacher_id = ?").run(lessonId, memberId).changes > 0;
}

/** Takes the teacher off the lesson, keeps their reason for the presidency, and tells the presidency. */
export async function declineTeaching(member: { id: number; display_name: string }, lesson: TeachLesson, reason: string) {
  if (lesson.teacher_id !== member.id) return false;
  const why = reason.trim().slice(0, 500);
  const d = db();
  d.transaction(() => {
    d.prepare("UPDATE lessons SET teacher_id = NULL, teacher_confirmed_at = NULL WHERE id = ? AND teacher_id = ?").run(lesson.id, member.id);
    d.prepare("DELETE FROM lesson_volunteers WHERE lesson_id = ? AND member_id = ?").run(lesson.id, member.id);
    d.prepare("INSERT INTO lesson_declines (lesson_id, member_id, reason) VALUES (?, ?, ?)").run(lesson.id, member.id, why);
    removeTeacherNotes(lesson.id, member.id);
  })();
  await notify(audienceMembers(lesson.org_id, "presidency"), {
    title: "Teacher needed",
    body: `${member.display_name} can't teach on ${formatDate(lesson.date, "short")}${lesson.title ? ` ("${lesson.title}")` : ""}.${why ? ` Reason: ${why}` : ""}`,
    url: `/admin/lessons/${lesson.id}`,
  });
  return true;
}
