import { DateTime } from "luxon";
import { db } from "./db";
import { storeReminders, TODO_WHEN, type TodoReminder } from "./personal-todos";
import type { EventRow } from "./types";

// A member's own events on their calendar: a doctor's appointment, a family dinner.
// Only they see them (on their calendar and Home's Coming up), and each can have any
// number of reminders, chosen like those on their private to-dos.

export interface PersonalEvent {
  id: number;
  member_id: number;
  title: string;
  notes: string;
  location: string;
  /** Its date and times (HH:MM) in `timezone` (the member's ward's when it was saved). */
  date: string;
  start_time: string;
  end_time: string | null;
  timezone: string;
  /** JSON, as for private to-dos (see todoReminders). */
  reminders: string;
}

/** Reminder timings: when it starts, or the same choices as other reminders. */
export const PERSONAL_EVENT_WHEN: [string, string][] = TODO_WHEN.map(([k, label]) => [k, k === "m:0" ? "When it starts" : label]);
/** What a new event starts with. */
export const STARTING_EVENT_REMINDERS: TodoReminder[] = [
  { when: "m:1440", push: true, text: false, email: false },
  { when: "m:60", push: true, text: false, email: false },
];

const iso = (d: DateTime) => d.toUTC().toISO({ suppressMilliseconds: true })!;

/** When it starts and ends, in UTC (an hour long without an end, or an end before the start). */
export function personalEventTimes(e: Pick<PersonalEvent, "date" | "start_time" | "end_time" | "timezone">): { starts: string; ends: string } {
  const start = DateTime.fromISO(`${e.date}T${e.start_time}`, { zone: e.timezone });
  let end = e.end_time ? DateTime.fromISO(`${e.date}T${e.end_time}`, { zone: e.timezone }) : start.plus({ hours: 1 });
  if (!end.isValid || end <= start) end = start.plus({ hours: 1 });
  return { starts: iso(start), ends: iso(end) };
}

export function getPersonalEvent(memberId: number, id: number): PersonalEvent | undefined {
  return db().prepare("SELECT * FROM personal_events WHERE id = ? AND member_id = ?").get(id, memberId) as PersonalEvent | undefined;
}

/** Saves an event (new when id is null). Returns its id, or null if it isn't theirs. */
export function savePersonalEvent(
  memberId: number,
  id: number | null,
  e: { title: string; notes: string; location: string; date: string; start_time: string; end_time: string | null; timezone: string; reminders: TodoReminder[] },
): number | null {
  const reminders = storeReminders(memberId, e.reminders);
  const d = db();
  const values = [e.title, e.notes, e.location, e.date, e.start_time, e.end_time, e.timezone, reminders];
  if (id) {
    const changed = d
      .prepare("UPDATE personal_events SET title = ?, notes = ?, location = ?, date = ?, start_time = ?, end_time = ?, timezone = ?, reminders = ? WHERE id = ? AND member_id = ?")
      .run(...values, id, memberId).changes;
    return changed ? id : null;
  }
  return Number(
    d
      .prepare("INSERT INTO personal_events (member_id, title, notes, location, date, start_time, end_time, timezone, reminders) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(memberId, ...values).lastInsertRowid,
  );
}

export function deletePersonalEvent(memberId: number, id: number) {
  db().prepare("DELETE FROM personal_events WHERE id = ? AND member_id = ?").run(id, memberId);
}

/** A member's own events between two UTC instants, shaped like calendar events. */
export function personalEventsBetween(memberId: number, fromUtc: string, toUtc: string): EventRow[] {
  // Dates a day either side (time zones), then exact times.
  const day = (u: string, days: number) => DateTime.fromISO(u, { zone: "utc" }).plus({ days }).toISODate()!;
  const rows = db()
    .prepare("SELECT * FROM personal_events WHERE member_id = ? AND date >= ? AND date <= ? ORDER BY date, start_time")
    .all(memberId, day(fromUtc, -1), day(toUtc, 1)) as PersonalEvent[];
  return rows
    .map((e) => ({ e, ...personalEventTimes(e) }))
    .filter(({ starts, ends }) => starts < toUtc && ends >= fromUtc)
    .map(({ e, starts, ends }) => ({
      id: -e.id,
      personal_event_id: e.id,
      org_id: 0,
      title: e.title,
      description: e.notes,
      location: e.location,
      starts_at: starts,
      ends_at: ends,
      presidency_only: 0,
      rsvp_enabled: 0,
      reminder_minutes: null,
      reminder2_minutes: null,
      flyer_file: null,
      flyer_name: null,
      series_id: null,
      invited: "",
      org_label: "Only you",
    }));
}

/** Where a calendar entry opens: a member's own event, a meeting they're invited to, or the event. */
export const eventHref = (e: Pick<EventRow, "id" | "personal_event_id" | "invited_meeting_id">) =>
  e.personal_event_id ? `/calendar/mine/${e.personal_event_id}` : e.invited_meeting_id ? `/meetings/${e.invited_meeting_id}` : `/calendar/${e.id}`;
