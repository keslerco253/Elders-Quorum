import { db } from "./db";
import { conductorOn } from "./conducting";
import type { CurrentUser } from "./types";
import { isAdmin, isPresidency } from "./permissions";
import { hasFeature } from "./orgs";
import { unreachedCount } from "./unreached";
import { unreadReplies } from "./conversations";
import { handlesBackup, messagesNeedingHome } from "./message-routing";
import { orgTodos } from "./assignments";
import { recordsToReview } from "./meetings";
import { newMembersToReview } from "./new-members";
import { todayIn } from "./time";

interface NeedLesson {
  id: number;
  date: string;
  title: string;
}

/** Upcoming lessons with members who offered to teach and no teacher yet. */
export function volunteerLessons(orgId: number): NeedLesson[] {
  return db()
    .prepare("SELECT DISTINCT l.id, l.date, l.title FROM lesson_volunteers v JOIN lessons l ON l.id = v.lesson_id WHERE l.org_id = ? AND l.teacher_id IS NULL AND l.no_teacher = 0 AND l.date >= date('now') ORDER BY l.date")
    .all(orgId) as NeedLesson[];
}

/**
 * Upcoming lessons whose teacher said they can't teach (or someone asked said no) and
 * nobody's been assigned yet (and no one has volunteered, which volunteerLessons covers).
 */
export function teacherNeededLessons(orgId: number, opts: { unseenBy?: number } = {}): NeedLesson[] {
  // Only ones this leader hasn't seen since the teacher (or someone asked) said no.
  const unseen = opts.unseenBy
    ? `AND NOT EXISTS (SELECT 1 FROM need_seen s WHERE s.member_id = @me AND s.lesson_id = l.id AND s.seen_at >= coalesce(max(
         coalesce((SELECT max(d.created_at) FROM lesson_declines d WHERE d.lesson_id = l.id), ''),
         coalesce((SELECT max(r.responded_at) FROM teaching_requests r WHERE r.lesson_id = l.id AND r.status = 'declined'), '')), ''))`
    : "";
  return db()
    .prepare(
      `SELECT l.id, l.date, l.title FROM lessons l WHERE l.org_id = @org AND l.teacher_id IS NULL AND l.no_teacher = 0 AND l.date >= date('now')
         AND (EXISTS (SELECT 1 FROM lesson_declines d WHERE d.lesson_id = l.id) OR EXISTS (SELECT 1 FROM teaching_requests r WHERE r.lesson_id = l.id AND r.status = 'declined'))
         AND NOT EXISTS (SELECT 1 FROM lesson_volunteers v WHERE v.lesson_id = l.id)
         AND NOT EXISTS (SELECT 1 FROM teaching_requests r WHERE r.lesson_id = l.id AND r.status = 'pending')
         ${unseen}
       ORDER BY l.date`,
    )
    .all(opts.unseenBy ? { org: orgId, me: opts.unseenBy } : { org: orgId }) as NeedLesson[];
}

/**
 * A leader has seen that these lessons need a teacher (opened the lesson, or the
 * lessons page listing it): they stop counting toward that leader's red number, and
 * the "Teacher needed" notification about each is marked read.
 */
export function markTeacherNeedsSeen(memberId: number, lessonIds: number[]) {
  const d = db();
  const seen = d.prepare("INSERT INTO need_seen (member_id, lesson_id, seen_at) VALUES (?, ?, datetime('now')) ON CONFLICT(member_id, lesson_id) DO UPDATE SET seen_at = excluded.seen_at");
  const read = d.prepare("UPDATE notification_log SET read_at = coalesce(read_at, datetime('now')) WHERE member_id = ? AND url LIKE ? AND title = 'Teacher needed'");
  d.transaction(() => {
    for (const id of lessonIds) {
      seen.run(memberId, id);
      read.run(memberId, `/admin/lessons/${id}%`);
    }
  })();
}

/** Straight to the lesson's Teacher section when there's one; the list of them when there are several. */
export const lessonsNeedHref = (lessons: NeedLesson[]) => (lessons.length === 1 ? `/admin/lessons/${lessons[0].id}#teacher` : "/admin/lessons#needs");

export function adminCounts(user: CurrentUser) {
  const d = db();
  const w = user.org_id;
  const one = (sql: string) => (d.prepare(sql).get(w) as { n: number }).n;
  if (!isAdmin(user))
    return { comments: 0, notes: 0, eventRequests: 0, access: 0, volunteers: 0, visitRequests: 0, replies: 0, teacherNeeded: 0, newTimes: 0, unassigned: 0, notAccepted: 0, unreached: 0, overdue: 0, toReview: 0, newMembers: 0, total: user.wardAdmin ? newMembersToReview(user.ward_id) : 0, volunteersHref: "/admin/lessons", teacherNeededHref: "/admin/lessons", shortcut: "/admin" };
  const comments = one("SELECT COUNT(*) AS n FROM comments c JOIN lessons l ON l.id = c.lesson_id WHERE l.org_id = ? AND c.status = 'pending'");
  const notes = one("SELECT COUNT(*) AS n FROM lesson_notes n JOIN lessons l ON l.id = n.lesson_id WHERE l.org_id = ? AND n.status = 'pending'");
  const eventRequests = one("SELECT COUNT(*) AS n FROM event_requests WHERE org_id = ? AND status = 'pending'");
  // Old join requests (from before join codes were required), for the bishopric.
  const access =
    user.org.kind === "ward" && isPresidency(user)
      ? (d.prepare("SELECT COUNT(*) AS n FROM members m JOIN ward_members wm ON wm.member_id = m.id WHERE wm.ward_id = ? AND m.status = 'pending'").get(user.ward_id) as { n: number }).n
      : 0;
  const volunteerList = isPresidency(user) ? volunteerLessons(w) : [];
  const volunteers = volunteerList.length;
  const visitRequests = isPresidency(user) ? one("SELECT COUNT(*) AS n FROM visit_requests WHERE org_id = ? AND status = 'open'") : 0;
  const replies = isPresidency(user) ? unreadReplies(w, user.id) : 0;
  const neededList = isPresidency(user) ? teacherNeededLessons(w) : [];
  // Counted (the red number) only for whoever conducts that Sunday (everyone when no
  // one's set), and only until they've seen it. Others see it on Manage lessons.
  const teacherNeeded = isPresidency(user) ? teacherNeededLessons(w, { unseenBy: user.id }).filter((l) => [user.id, null].includes(conductorOn(w, l.date))).length : 0;
  // Visit invitations where the member asked for another time.
  const newTimes = isPresidency(user) ? one("SELECT COUNT(*) AS n FROM planned_visits WHERE org_id = ? AND invite_status = 'new_time'") : 0;
  // Open assignments no one has (never given to anyone, or the person was unable to do it).
  const unassigned = isPresidency(user) && hasFeature(user.org, "todos") ? one("SELECT COUNT(*) AS n FROM todos WHERE org_id = ? AND done = 0 AND assignee_id IS NULL") : 0;
  // Things sent to someone that reached them by no means: tell them another way.
  const unreached = isPresidency(user) ? unreachedCount(w) : 0;
  // Assignment requests the person hasn't accepted yet.
  const notAccepted = isPresidency(user) && hasFeature(user.org, "todos") ? one("SELECT COUNT(*) AS n FROM todos WHERE org_id = ? AND done = 0 AND assignee_id IS NOT NULL AND accept_status = 'pending'") : 0;
  // The other red numbers on the Admin page: overdue assignments, presidency records to
  // review, and (for ward administrators) new members to check.
  const planning = isPresidency(user) && hasFeature(user.org, "todos");
  const today = todayIn(user.ward.timezone);
  const overdue = planning ? orgTodos(w).filter((t) => !t.done && t.due_date && t.due_date < today).length : 0;
  const toReview = planning ? recordsToReview(w, today).length : 0;
  const newMembers = user.wardAdmin ? newMembersToReview(user.ward_id) : 0;
  const volunteersHref = lessonsNeedHref(volunteerList);
  const teacherNeededHref = lessonsNeedHref(neededList);
  // Where each kind of item is handled. When everything waiting is in one place, go straight there.
  const places = [
    [comments, "/admin/comments"],
    [notes, "/admin/notes"],
    [eventRequests, "/admin/event-requests"],
    [access, "/admin/access"],
    [volunteers + teacherNeeded, lessonsNeedHref([...volunteerList, ...neededList])],
    [visitRequests, "/admin/visit-requests"],
    [newTimes, "/admin/visits"],
    [unassigned, "/admin/todos?show=unassigned"],
    [notAccepted, "/admin/todos?show=pending"],
    [unreached, "/admin/unreached"],
    [overdue, "/admin/todos"],
    [toReview, "/admin/meetings"],
    [newMembers, "/ward-settings/new-members"],
  ].filter(([n]) => Number(n) > 0) as [number, string][];
  return {
    volunteersHref,
    teacherNeededHref,
    shortcut: places.length === 1 ? places[0][1] : "/admin",
    newTimes,
    comments,
    notes,
    eventRequests,
    access,
    volunteers,
    visitRequests,
    replies,
    teacherNeeded,
    unassigned,
    notAccepted,
    unreached,
    overdue,
    toReview,
    newMembers,
    // Every red number on the Admin page, added up. Unread messages from members count on the Messages tab, not here.
    total: comments + notes + eventRequests + access + volunteers + visitRequests + teacherNeeded + newTimes + unassigned + notAccepted + unreached + overdue + toReview + newMembers,
  };
}

/** Members' messages waiting for this person to pass on (they're the ward's backup person). */
export function passOnCount(user: CurrentUser): number {
  return handlesBackup(user) ? messagesNeedingHome(user.ward_id).length : 0;
}

/** Ward tools that put the Admin tab in front of someone who isn't a leader here. */
export function hasAdminTab(user: CurrentUser): boolean {
  return user.wardAdmin || !!user.is_site_owner || passOnCount(user) > 0;
}
