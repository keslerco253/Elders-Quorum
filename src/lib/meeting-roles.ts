import { DateTime } from "luxon";
import { db } from "./db";
import { getMeeting, meetingName, MEETING_ROLES, type MeetingRole } from "./meetings";
import { reviewDate } from "./assignments";

/**
 * Giving the opening prayer, the spiritual thought or the closing prayer in a meeting
 * is an assignment for the person chosen: it's on their list (with its reminders) until
 * the meeting, and they can ask someone else to take it like any assignment. Whoever
 * has it is shown on the meeting.
 */

const label = (role: MeetingRole) => MEETING_ROLES.find(([k]) => k === role)![1];

export function roleTodoId(meetingId: number, role: MeetingRole): { id: number; assignee_id: number | null; done: number } | undefined {
  return db().prepare("SELECT id, assignee_id, done FROM todos WHERE meeting_id = ? AND meeting_role = ?").get(meetingId, role) as { id: number; assignee_id: number | null; done: number } | undefined;
}

/** "Opening prayer: Presidency meeting". */
export function roleTitle(orgId: number, meetingId: number, role: MeetingRole): string {
  return `${label(role)}: ${meetingName(orgId, getMeeting(orgId, meetingId))}`;
}

/**
 * Chooses who gives it (null: no one). Returns who had it before (to tell them it's no
 * longer theirs) and the assignment, when someone new has it.
 */
export function assignMeetingRole(orgId: number, meetingId: number, role: MeetingRole, memberId: number | null, byId: number): { previous: number | null; todoId: number | null; changed: boolean } {
  const d = db();
  const m = getMeeting(orgId, meetingId);
  if (!m) return { previous: null, todoId: null, changed: false };
  const name = memberId ? ((d.prepare("SELECT display_name FROM members WHERE id = ?").get(memberId) as { display_name: string } | undefined)?.display_name ?? "") : "";
  const had = roleTodoId(meetingId, role);
  const previous = had && !had.done ? had.assignee_id : null;
  return d.transaction(() => {
    d.prepare(`UPDATE meetings SET ${role} = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?`).run(name, meetingId, orgId);
    if (!memberId) {
      if (had) d.prepare("DELETE FROM todos WHERE id = ?").run(had.id);
      return { previous, todoId: null, changed: !!had };
    }
    if (had?.assignee_id === memberId) return { previous: null, todoId: had.id, changed: false };
    if (had) {
      d.prepare("UPDATE todos SET assignee_id = ?, status = 'open', done = 0, done_at = NULL, accept_status = 'accepted' WHERE id = ?").run(memberId, had.id);
      d.prepare("UPDATE todo_handoffs SET status = 'cancelled', decided_at = datetime('now') WHERE todo_id = ? AND status = 'pending'").run(had.id);
      return { previous, todoId: had.id, changed: true };
    }
    const id = Number(
      d
        .prepare(
          `INSERT INTO todos (org_id, title, notes, due_date, due_time, assignee_id, created_by, meeting_id, meeting_role, reminder1_days, reminder2_days, accept_status)
           VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, 1, NULL, 'accepted')`,
        )
        .run(orgId, roleTitle(orgId, meetingId, role), m.date, m.time, memberId, byId, meetingId, role).lastInsertRowid,
    );
    return { previous, todoId: id, changed: true };
  })();
}

/** After an assignment for a meeting role changes hands (handed off, or they can't), the meeting shows who has it now. */
export function syncRoleFromTodo(todoId: number) {
  const d = db();
  const t = d.prepare("SELECT t.meeting_id, t.meeting_role, m.display_name FROM todos t LEFT JOIN members m ON m.id = t.assignee_id WHERE t.id = ?").get(todoId) as
    | { meeting_id: number | null; meeting_role: string | null; display_name: string | null }
    | undefined;
  if (!t?.meeting_id || !MEETING_ROLES.some(([k]) => k === t.meeting_role)) return;
  d.prepare(`UPDATE meetings SET ${t.meeting_role} = ?, updated_at = datetime('now') WHERE id = ?`).run(t.display_name ?? "", t.meeting_id);
}

/** Before an assignment is deleted: a meeting role it was for goes back to not chosen. */
export function clearRoleForTodo(todoId: number) {
  const d = db();
  const t = d.prepare("SELECT meeting_id, meeting_role FROM todos WHERE id = ?").get(todoId) as { meeting_id: number | null; meeting_role: string | null } | undefined;
  if (!t?.meeting_id || !MEETING_ROLES.some(([k]) => k === t.meeting_role)) return;
  d.prepare(`UPDATE meetings SET ${t.meeting_role} = '', updated_at = datetime('now') WHERE id = ?`).run(t.meeting_id);
}

/** A meeting moved: its role assignments are due at the new time, with the meeting's name. */
export function syncRoleTodosWhen(orgId: number, meetingId: number) {
  const m = getMeeting(orgId, meetingId);
  if (!m) return;
  const d = db();
  for (const [role] of MEETING_ROLES)
    d.prepare("UPDATE todos SET due_date = ?, due_time = ?, title = ? WHERE meeting_id = ? AND meeting_role = ? AND done = 0").run(m.date, m.time, roleTitle(orgId, meetingId, role), meetingId, role);
}

/** Once the meeting is held (finished, or its day has passed), its role assignments are done. */
export function closeRoleTodos(meetingId: number | null, today = DateTime.utc().toISODate()!) {
  const d = db();
  const rows = (
    meetingId
      ? d.prepare("SELECT id FROM todos WHERE meeting_id = ? AND meeting_role IS NOT NULL AND done = 0").all(meetingId)
      : d.prepare("SELECT id FROM todos WHERE meeting_role IS NOT NULL AND done = 0 AND due_date < ?").all(DateTime.fromISO(today).minus({ days: 1 }).toISODate())
  ) as { id: number }[];
  for (const r of rows)
    d.prepare("UPDATE todos SET status = 'done', done = 1, done_at = datetime('now'), review_at = ? WHERE id = ?").run(reviewDate(today), r.id);
  d.prepare("UPDATE todo_handoffs SET status = 'cancelled', decided_at = datetime('now') WHERE status = 'pending' AND todo_id IN (SELECT id FROM todos WHERE meeting_role IS NOT NULL AND done = 1)").run();
}
