import { db } from "./db";

/**
 * Reporting and blocking (what app stores require where members post things others
 * see). A reported comment is hidden for whoever reported it right away, and goes to
 * the presidency to hide or keep. Blocking someone hides everything they post from you.
 */

/** Reports an approved comment the member can see. The lesson's organization and its id, or null. */
export function reportComment(commentId: number, reporterId: number, reason: string): { orgId: number; lessonId: number } | null {
  const d = db();
  const c = d
    .prepare(
      `SELECT l.org_id, c.lesson_id, c.member_id FROM comments c JOIN lessons l ON l.id = c.lesson_id JOIN orgs o ON o.id = l.org_id
       WHERE c.id = ? AND c.status = 'approved' AND EXISTS (SELECT 1 FROM ward_members wm WHERE wm.ward_id = o.ward_id AND wm.member_id = ?)`,
    )
    .get(commentId, reporterId) as { org_id: number; lesson_id: number; member_id: number } | undefined;
  if (!c || c.member_id === reporterId) return null;
  d.prepare(
    `INSERT INTO comment_reports (comment_id, reporter_id, reason) VALUES (?, ?, ?)
     ON CONFLICT(comment_id, reporter_id) DO UPDATE SET reason = excluded.reason, handled_at = NULL`,
  ).run(commentId, reporterId, reason.trim().slice(0, 500));
  return { orgId: c.org_id, lessonId: c.lesson_id };
}

export function blockMember(memberId: number, blockedId: number): boolean {
  if (!blockedId || memberId === blockedId) return false;
  if (!db().prepare("SELECT 1 FROM members WHERE id = ?").get(blockedId)) return false;
  db().prepare("INSERT OR IGNORE INTO member_blocks (member_id, blocked_id) VALUES (?, ?)").run(memberId, blockedId);
  return true;
}

export function unblockMember(memberId: number, blockedId: number) {
  db().prepare("DELETE FROM member_blocks WHERE member_id = ? AND blocked_id = ?").run(memberId, blockedId);
}

/** The people a member has blocked. */
export function blockedBy(memberId: number): { id: number; display_name: string }[] {
  return db()
    .prepare("SELECT m.id, m.display_name FROM member_blocks b JOIN members m ON m.id = b.blocked_id WHERE b.member_id = ? ORDER BY m.display_name COLLATE NOCASE")
    .all(memberId) as { id: number; display_name: string }[];
}

export interface ReportedComment {
  comment_id: number;
  body: string;
  author: string;
  lesson_id: number;
  lesson_date: string;
  lesson_title: string;
  reports: number;
  reasons: string;
  last_at: string;
}

/** Comments in an organization reported and not yet looked at by its presidency. */
export function openReports(orgId: number): ReportedComment[] {
  return db()
    .prepare(
      `SELECT c.id AS comment_id, c.body, m.display_name AS author, l.id AS lesson_id, l.date AS lesson_date, l.title AS lesson_title,
              COUNT(r.id) AS reports, group_concat(NULLIF(r.reason, ''), ' · ') AS reasons, MAX(r.created_at) AS last_at
       FROM comment_reports r JOIN comments c ON c.id = r.comment_id JOIN members m ON m.id = c.member_id JOIN lessons l ON l.id = c.lesson_id
       WHERE l.org_id = ? AND r.handled_at IS NULL AND c.status = 'approved'
       GROUP BY c.id ORDER BY last_at`,
    )
    .all(orgId) as ReportedComment[];
}

export const openReportCount = (orgId: number) => openReports(orgId).length;

/** The presidency's answer: hide the comment from everyone, or keep it (it stays hidden for whoever reported it). */
export function handleReport(orgId: number, commentId: number, hide: boolean, by: number): boolean {
  const d = db();
  const ok = d.prepare("SELECT 1 FROM comments c JOIN lessons l ON l.id = c.lesson_id WHERE c.id = ? AND l.org_id = ?").get(commentId, orgId);
  if (!ok) return false;
  d.transaction(() => {
    if (hide) d.prepare("UPDATE comments SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?").run(by, commentId);
    d.prepare("UPDATE comment_reports SET handled_at = datetime('now') WHERE comment_id = ? AND handled_at IS NULL").run(commentId);
  })();
  return true;
}
