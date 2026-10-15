import { db } from "./db";
import type { Lesson } from "./types";

export interface LessonListItem extends Lesson {
  teacher_name: string | null;
  comment_count: number;
  volunteer_count: number;
  decline_count: number;
  asked_names: string | null;
}

const LIST_SQL = `
  SELECT l.*, t.display_name AS teacher_name,
    (SELECT COUNT(*) FROM comments c WHERE c.lesson_id = l.id AND c.status = 'approved') AS comment_count,
    (SELECT COUNT(*) FROM lesson_volunteers v WHERE v.lesson_id = l.id) AS volunteer_count,
    (SELECT COUNT(*) FROM lesson_declines d WHERE d.lesson_id = l.id) AS decline_count,
    (SELECT group_concat(m.display_name, ', ') FROM teaching_requests r JOIN members m ON m.id = r.member_id WHERE r.lesson_id = l.id AND r.status = 'pending') AS asked_names
  FROM lessons l LEFT JOIN members t ON t.id = l.teacher_id
  WHERE l.org_id = ?`;

export function upcomingLessons(orgId: number, fromDate: string, limit = 60): LessonListItem[] {
  return db().prepare(LIST_SQL + " AND l.date >= ? ORDER BY l.date LIMIT ?").all(orgId, fromDate, limit) as LessonListItem[];
}

/**
 * Sundays (from a date) still waiting for a talk, in order: a lesson with no link and
 * no title typed in. Conference Sundays and ones already filled are skipped.
 */
export function openLessonSundays(orgId: number, fromDate: string): { id: number; date: string }[] {
  return db()
    .prepare("SELECT id, date FROM lessons WHERE org_id = ? AND date >= ? AND kind = 'talk' AND url = '' AND title = '' ORDER BY date")
    .all(orgId, fromDate) as { id: number; date: string }[];
}

export function pastLessons(orgId: number, beforeDate: string, limit = 60): LessonListItem[] {
  return db().prepare(LIST_SQL + " AND l.date < ? ORDER BY l.date DESC LIMIT ?").all(orgId, beforeDate, limit) as LessonListItem[];
}

export function getLesson(orgId: number, id: number): LessonListItem | undefined {
  return db().prepare(LIST_SQL + " AND l.id = ?").get(orgId, id) as LessonListItem | undefined;
}

export function lessonOn(orgId: number, date: string): LessonListItem | undefined {
  return db().prepare(LIST_SQL + " AND l.date = ?").get(orgId, date) as LessonListItem | undefined;
}

export interface CommentView {
  id: number;
  parent_id: number | null;
  member_id: number;
  author: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  replies: CommentView[];
}

/**
 * Approved comments as a thread, plus the viewer's own comments that are
 * still waiting for approval (only they see those).
 */
export function commentThread(lessonId: number, viewerId: number): CommentView[] {
  const rows = db()
    .prepare(
      `SELECT c.id, c.parent_id, c.member_id, m.display_name AS author, c.body, c.status, c.created_at
       FROM comments c JOIN members m ON m.id = c.member_id
       WHERE c.lesson_id = ? AND (c.status = 'approved' OR (c.status = 'pending' AND c.member_id = ?))
       ORDER BY c.created_at, c.id`,
    )
    .all(lessonId, viewerId) as Omit<CommentView, "replies">[];
  const byId = new Map<number, CommentView>(rows.map((r) => [r.id, { ...r, replies: [] }]));
  const top: CommentView[] = [];
  for (const c of byId.values()) {
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
    if (c.parent_id && parent) parent.replies.push(c);
    else if (!c.parent_id) top.push(c);
  }
  return top;
}
