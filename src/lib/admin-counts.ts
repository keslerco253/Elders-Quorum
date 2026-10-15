import { db } from "./db";
import type { CurrentUser } from "./types";
import { isAdmin, isPresidency } from "./permissions";
import { unreadReplies } from "./conversations";

export function adminCounts(user: CurrentUser) {
  const d = db();
  const w = user.org_id;
  const one = (sql: string) => (d.prepare(sql).get(w) as { n: number }).n;
  if (!isAdmin(user)) return { comments: 0, notes: 0, eventRequests: 0, access: 0, volunteers: 0, visitRequests: 0, replies: 0, teacherNeeded: 0, newTimes: 0, total: 0 };
  const comments = one("SELECT COUNT(*) AS n FROM comments c JOIN lessons l ON l.id = c.lesson_id WHERE l.org_id = ? AND c.status = 'pending'");
  const notes = one("SELECT COUNT(*) AS n FROM lesson_notes n JOIN lessons l ON l.id = n.lesson_id WHERE l.org_id = ? AND n.status = 'pending'");
  const eventRequests = one("SELECT COUNT(*) AS n FROM event_requests WHERE org_id = ? AND status = 'pending'");
  // Old join requests (from before join codes were required), for the bishopric.
  const access =
    user.org.kind === "ward" && isPresidency(user)
      ? (d.prepare("SELECT COUNT(*) AS n FROM members m JOIN ward_members wm ON wm.member_id = m.id WHERE wm.ward_id = ? AND m.status = 'pending'").get(user.ward_id) as { n: number }).n
      : 0;
  const volunteers = isPresidency(user)
    ? one("SELECT COUNT(DISTINCT v.lesson_id) AS n FROM lesson_volunteers v JOIN lessons l ON l.id = v.lesson_id WHERE l.org_id = ? AND l.teacher_id IS NULL AND l.date >= date('now')")
    : 0;
  const visitRequests = isPresidency(user) ? one("SELECT COUNT(*) AS n FROM visit_requests WHERE org_id = ? AND status = 'open'") : 0;
  const replies = isPresidency(user) ? unreadReplies(w, user.id) : 0;
  // Upcoming lessons whose teacher said they can't teach and nobody's been assigned yet
  // (and no one has volunteered, which the volunteers count already covers).
  const teacherNeeded = isPresidency(user)
    ? one(
        `SELECT COUNT(*) AS n FROM lessons l WHERE l.org_id = ? AND l.teacher_id IS NULL AND l.date >= date('now')
           AND (EXISTS (SELECT 1 FROM lesson_declines d WHERE d.lesson_id = l.id) OR EXISTS (SELECT 1 FROM teaching_requests r WHERE r.lesson_id = l.id AND r.status = 'declined'))
           AND NOT EXISTS (SELECT 1 FROM lesson_volunteers v WHERE v.lesson_id = l.id)
           AND NOT EXISTS (SELECT 1 FROM teaching_requests r WHERE r.lesson_id = l.id AND r.status = 'pending')`,
      )
    : 0;
  // Visit invitations where the member asked for another time.
  const newTimes = isPresidency(user) ? one("SELECT COUNT(*) AS n FROM planned_visits WHERE org_id = ? AND invite_status = 'new_time'") : 0;
  return {
    newTimes,
    comments,
    notes,
    eventRequests,
    access,
    volunteers,
    visitRequests,
    replies,
    teacherNeeded,
    // Unread messages from members count on the Messages tab, not here.
    total: comments + notes + eventRequests + access + volunteers + visitRequests + teacherNeeded + newTimes,
  };
}
