import { db } from "./db";

export interface LessonNotes {
  lesson_id: number;
  author_id: number | null;
  author: string | null;
  body: string;
  status: "pending" | "approved" | "rejected";
  published_body: string | null;
  published_at: string | null;
  notified: number;
  review_note: string | null;
  updated_at: string;
}

export function getNotes(lessonId: number): LessonNotes | undefined {
  return db()
    .prepare("SELECT n.*, m.display_name AS author FROM lesson_notes n LEFT JOIN members m ON m.id = n.author_id WHERE n.lesson_id = ?")
    .get(lessonId) as LessonNotes | undefined;
}

/** Saves a draft from the teacher. What members see doesn't change until approval. */
export function submitNotes(lessonId: number, authorId: number, body: string) {
  db()
    .prepare(
      `INSERT INTO lesson_notes (lesson_id, author_id, body, status) VALUES (?, ?, ?, 'pending')
       ON CONFLICT(lesson_id) DO UPDATE SET author_id = excluded.author_id, body = excluded.body,
         status = 'pending', review_note = NULL, updated_at = datetime('now')`,
    )
    .run(lessonId, authorId, body);
}

/**
 * Publishes the current draft. Returns true the first time a lesson's notes
 * are published, which is when the quorum gets a notification.
 */
export function publishNotes(lessonId: number, reviewerId: number): boolean {
  const d = db();
  return d.transaction(() => {
    const n = d.prepare("SELECT notified FROM lesson_notes WHERE lesson_id = ?").get(lessonId) as { notified: number } | undefined;
    if (!n) return false;
    d.prepare(
      `UPDATE lesson_notes SET status = 'approved', published_body = body, published_at = datetime('now'),
         reviewed_by = ?, review_note = NULL, notified = 1, updated_at = datetime('now') WHERE lesson_id = ?`,
    ).run(reviewerId, lessonId);
    return n.notified === 0;
  })();
}

export function rejectNotes(lessonId: number, reviewerId: number, note: string) {
  db()
    .prepare("UPDATE lesson_notes SET status = 'rejected', review_note = ?, reviewed_by = ?, updated_at = datetime('now') WHERE lesson_id = ?")
    .run(note || null, reviewerId, lessonId);
}
