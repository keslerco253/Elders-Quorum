import { db } from "./db";
import { ledOrgIds } from "./conversations";
import type { ReminderChannel } from "./reminder-prefs";

// A member's own private to-dos: only they see them (not the presidency). Reminders
// come by app notification and/or email; presidency members can also have texts.

export interface PersonalTodo {
  id: number;
  member_id: number;
  title: string;
  notes: string;
  due_date: string | null;
  reminder1_days: number | null;
  reminder2_days: number | null;
  /** How reminders come: "push,email" etc. */
  channels: string;
  done: number;
  done_at: string | null;
}

/** Ways this member may choose for their own to-dos: texts only for presidency members. */
export function personalChannels(memberId: number): ReminderChannel[] {
  return ledOrgIds(memberId).length ? ["push", "email", "text"] : ["push", "email"];
}

export function getPersonalTodo(memberId: number, id: number): PersonalTodo | undefined {
  return db().prepare("SELECT * FROM personal_todos WHERE id = ? AND member_id = ?").get(id, memberId) as PersonalTodo | undefined;
}

export function personalTodos(memberId: number, done: boolean): PersonalTodo[] {
  return db()
    .prepare(
      `SELECT * FROM personal_todos WHERE member_id = ? AND done = ? ${done ? "AND done_at > datetime('now', '-6 months') ORDER BY done_at DESC" : "ORDER BY due_date IS NULL, due_date, id"}`,
    )
    .all(memberId, done ? 1 : 0) as PersonalTodo[];
}

/** Saves a to-do (new when id is null). Ways not allowed are dropped; none left means an app notification. */
export function savePersonalTodo(
  memberId: number,
  id: number | null,
  t: { title: string; notes: string; due_date: string | null; reminder1_days: number | null; reminder2_days: number | null; channels: string[] },
): number | null {
  const allowed = personalChannels(memberId);
  const ways = t.channels.filter((c): c is ReminderChannel => allowed.includes(c as ReminderChannel));
  const channels = (ways.length ? ways : ["push"]).join(",");
  const d = db();
  if (id) {
    const changed = d
      .prepare("UPDATE personal_todos SET title = ?, notes = ?, due_date = ?, reminder1_days = ?, reminder2_days = ?, channels = ? WHERE id = ? AND member_id = ?")
      .run(t.title, t.notes, t.due_date, t.reminder1_days, t.reminder2_days, channels, id, memberId).changes;
    return changed ? id : null;
  }
  return Number(
    d
      .prepare("INSERT INTO personal_todos (member_id, title, notes, due_date, reminder1_days, reminder2_days, channels) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(memberId, t.title, t.notes, t.due_date, t.reminder1_days, t.reminder2_days, channels).lastInsertRowid,
  );
}

export function setPersonalTodoDone(memberId: number, id: number, done: boolean) {
  db().prepare("UPDATE personal_todos SET done = ?, done_at = CASE WHEN ? = 1 THEN datetime('now') END WHERE id = ? AND member_id = ?").run(done ? 1 : 0, done ? 1 : 0, id, memberId);
}

export function deletePersonalTodo(memberId: number, id: number) {
  db().prepare("DELETE FROM personal_todos WHERE id = ? AND member_id = ?").run(id, memberId);
}

/** The ways a saved to-do's reminders come, still allowed for this member now. */
export function todoChannels(memberId: number, channels: string): ReminderChannel[] {
  const allowed = personalChannels(memberId);
  const ways = channels.split(",").filter((c): c is ReminderChannel => allowed.includes(c as ReminderChannel));
  return ways.length ? ways : ["push"];
}
