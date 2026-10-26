import { DateTime } from "luxon";
import { db } from "./db";
import { ledOrgIds } from "./conversations";
import { WHEN_OPTIONS } from "./reminder-prefs";

// A member's own private to-dos: only they see them (not the presidency). Each can
// have a due date and time and any number of reminders, like event reminders. Each
// reminder comes by any of app notification, email and (for presidency members, up to
// 3) text; with none chosen, by app notification. Personal calendar events use the
// same reminders.

export interface PersonalTodo {
  id: number;
  member_id: number;
  title: string;
  notes: string;
  due_date: string | null;
  /** Time of day it's due (HH:MM), if any; reminders count from 9 AM without one. */
  due_time: string | null;
  /** JSON: [{ when: "m:60", push: 0 | 1, text: 0 | 1, email: 0 | 1 }, ...] (see todoReminders). */
  reminders: string;
  done: number;
  done_at: string | null;
}

/** One reminder: minutes before it's due ("m:60"), and how it comes. */
export interface TodoReminder {
  when: string;
  push: boolean;
  text: boolean;
  email: boolean;
}

export type ReminderWay = "push" | "text" | "email";
/** The ways a reminder comes, for notify's `only`. */
export const reminderWays = (r: TodoReminder): ReminderWay[] => (["push", "text", "email"] as const).filter((w) => r[w]);

export const MAX_TODO_REMINDERS = 10;
export const MAX_TODO_TEXTS = 3;
/** When a reminder can be: at the due time, or the same choices as event reminders. */
// "3 days before" too: to-dos made before reminders were chosen this way could have it.
export const TODO_WHEN: [string, string][] = [["m:0", "When it's due"], ...WHEN_OPTIONS.events.flatMap((o): [string, string][] => (o[0] === "m:2880" ? [o, ["m:4320", "3 days before"]] : [o]))];
/** What a new to-do starts with. */
export const STARTING_TODO_REMINDERS: TodoReminder[] = [
  { when: "m:1440", push: true, text: false, email: false },
  { when: "m:60", push: true, text: false, email: false },
];
/** Without a time, reminders count from this time on the due date. */
export const DEFAULT_DUE_TIME = "09:00";

/** Whether this member may have to-do reminders by text: presidency (or bishopric) members. */
export const canTextTodos = (memberId: number) => ledOrgIds(memberId).length > 0;

/**
 * Saved reminders (a to-do's or a personal event's), as they can be used now. Ones
 * saved before the ways could be chosen were a text, or else an app notification.
 */
export function todoReminders(t: Pick<PersonalTodo, "reminders">): TodoReminder[] {
  try {
    const raw = JSON.parse(t.reminders) as { when?: unknown; push?: unknown; text?: unknown; email?: unknown }[];
    return raw
      .filter((r) => TODO_WHEN.some(([k]) => k === r.when))
      .map((r) => ({ when: String(r.when), push: r.push === undefined ? !r.text : !!r.push, text: !!r.text, email: !!r.email }));
  } catch {
    return [];
  }
}

/**
 * Keeps known times once each (up to 10); texts only for presidency members, up to 3;
 * email only with an email on the account. A reminder left with no way comes as an
 * app notification.
 */
export function cleanReminders(memberId: number, list: TodoReminder[]): TodoReminder[] {
  const texts = canTextTodos(memberId);
  const hasEmail = !!(db().prepare("SELECT email FROM members WHERE id = ?").get(memberId) as { email: string | null } | undefined)?.email;
  const out: TodoReminder[] = [];
  let textCount = 0;
  for (const r of list) {
    if (!TODO_WHEN.some(([k]) => k === r.when) || out.some((x) => x.when === r.when)) continue;
    const text = texts && r.text && textCount < MAX_TODO_TEXTS;
    if (text) textCount++;
    const email = hasEmail && r.email;
    out.push({ when: r.when, text, email, push: r.push || (!text && !email) });
    if (out.length === MAX_TODO_REMINDERS) break;
  }
  // Soonest-before-due last, like a countdown.
  const minutes = (w: string) => Number(w.slice(2));
  return out.sort((a, b) => minutes(b.when) - minutes(a.when));
}

/** When a to-do is due, in UTC (its time, or 9 AM), for counting reminders. */
export function dueAtUtc(t: Pick<PersonalTodo, "due_date" | "due_time">, tz: string): string | null {
  if (!t.due_date) return null;
  return DateTime.fromISO(`${t.due_date}T${t.due_time ?? DEFAULT_DUE_TIME}`, { zone: tz }).toUTC().toISO();
}

export function getPersonalTodo(memberId: number, id: number): PersonalTodo | undefined {
  return db().prepare("SELECT * FROM personal_todos WHERE id = ? AND member_id = ?").get(id, memberId) as PersonalTodo | undefined;
}

export function personalTodos(memberId: number, done: boolean): PersonalTodo[] {
  return db()
    .prepare(
      `SELECT * FROM personal_todos WHERE member_id = ? AND done = ? ${done ? "AND done_at > datetime('now', '-6 months') ORDER BY done_at DESC" : "ORDER BY due_date IS NULL, due_date, due_time IS NULL, due_time, id"}`,
    )
    .all(memberId, done ? 1 : 0) as PersonalTodo[];
}

/** Saves a to-do (new when id is null). Returns its id, or null if it isn't theirs. */
export function savePersonalTodo(
  memberId: number,
  id: number | null,
  t: { title: string; notes: string; due_date: string | null; due_time: string | null; reminders: TodoReminder[] },
): number | null {
  const reminders = storeReminders(memberId, t.reminders);
  const time = t.due_date ? t.due_time : null;
  const d = db();
  if (id) {
    const changed = d
      .prepare("UPDATE personal_todos SET title = ?, notes = ?, due_date = ?, due_time = ?, reminders = ? WHERE id = ? AND member_id = ?")
      .run(t.title, t.notes, t.due_date, time, reminders, id, memberId).changes;
    return changed ? id : null;
  }
  return Number(
    d
      .prepare("INSERT INTO personal_todos (member_id, title, notes, due_date, due_time, reminders) VALUES (?, ?, ?, ?, ?, ?)")
      .run(memberId, t.title, t.notes, t.due_date, time, reminders).lastInsertRowid,
  );
}

export function setPersonalTodoDone(memberId: number, id: number, done: boolean) {
  db().prepare("UPDATE personal_todos SET done = ?, done_at = CASE WHEN ? = 1 THEN datetime('now') END WHERE id = ? AND member_id = ?").run(done ? 1 : 0, done ? 1 : 0, id, memberId);
}

export function deletePersonalTodo(memberId: number, id: number) {
  db().prepare("DELETE FROM personal_todos WHERE id = ? AND member_id = ?").run(id, memberId);
}

/** Reminders as saved (JSON), after cleanReminders. */
export function storeReminders(memberId: number, list: TodoReminder[]): string {
  return JSON.stringify(cleanReminders(memberId, list).map((r) => ({ when: r.when, push: r.push ? 1 : 0, text: r.text ? 1 : 0, email: r.email ? 1 : 0 })));
}

/** Reminder rows from a form: "when" for each, and ways push_<row>, text_<row>, email_<row>. */
export function remindersFromForm(fd: FormData): TodoReminder[] {
  return fd.getAll("when").map((w, i) => ({
    when: String(w),
    push: fd.get(`push_${i}`) === "on",
    text: fd.get(`text_${i}`) === "on",
    email: fd.get(`email_${i}`) === "on",
  }));
}
