import { DateTime } from "luxon";
import { db } from "./db";
import { storeReminders, TODO_WHEN, type TodoReminder } from "./personal-todos";
import type { EventRow } from "./types";
import { describeRecurrence, occurrenceDates, type Pattern } from "./recurrence";

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
  /** No times: the whole day (start_time is stored as 00:00). */
  all_day: number;
  timezone: string;
  /** JSON, as for private to-dos (see todoReminders). */
  reminders: string;
  /** Repeats (from `date`, its first), until this date or for good. */
  repeat: Pattern | null;
  repeat_until: string | null;
  /** JSON list of dates (yyyy-mm-dd) taken off a repeating event. */
  skip_dates: string;
}

const skips = (e: Pick<PersonalEvent, "skip_dates">): string[] => {
  try {
    return JSON.parse(e.skip_dates) as string[];
  } catch {
    return [];
  }
};

/** "Every week on Tuesday, until Jan 6, 2027", or null when it doesn't repeat. */
export const repeatText = (e: Pick<PersonalEvent, "repeat" | "date" | "repeat_until">) => (e.repeat ? describeRecurrence({ pattern: e.repeat, start: e.date, until: e.repeat_until, count: null }) : null);

/**
 * Its dates between two days (yyyy-mm-dd), each as the event on that date: one for an
 * event that doesn't repeat, every date of the series (but skipped ones) for one that does.
 */
export function occurrences(e: PersonalEvent, from: string, to: string): PersonalEvent[] {
  if (!e.repeat) return e.date >= from && e.date <= to ? [e] : [];
  const off = skips(e);
  return occurrenceDates({ pattern: e.repeat, start: e.date, until: e.repeat_until, count: null }, from, to)
    .filter((d) => !off.includes(d))
    .map((d) => ({ ...e, date: d }));
}

/** Events (as saved) that may have a date between two days: on one of them, or repeating across them. */
export function personalRowsBetween(where: string, args: unknown[], from: string, to: string): PersonalEvent[] {
  return db()
    .prepare(`SELECT e.* FROM personal_events e JOIN members m ON m.id = e.member_id WHERE ${where} AND ((e.repeat IS NULL AND e.date >= @from AND e.date <= @to) OR (e.repeat IS NOT NULL AND e.date <= @to AND (e.repeat_until IS NULL OR e.repeat_until >= @from)))`)
    .all(...args, { from, to }) as PersonalEvent[];
}

/** Takes one date off a repeating event ("just this one"). */
export function skipPersonalDate(memberId: number, id: number, date: string): boolean {
  const e = getPersonalEvent(memberId, id);
  if (!e?.repeat || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const list = [...new Set([...skips(e), date])].sort().slice(-500);
  db().prepare("UPDATE personal_events SET skip_dates = ? WHERE id = ?").run(JSON.stringify(list), e.id);
  return true;
}

/** Reminder timings: when it starts, or the same choices as other reminders. */
export const PERSONAL_EVENT_WHEN: [string, string][] = TODO_WHEN.map(([k, label]) => [k, k === "m:0" ? "When it starts" : label]);
/** What a new event starts with. */
export const STARTING_EVENT_REMINDERS: TodoReminder[] = [
  { when: "m:1440", push: true, text: false, email: false },
  { when: "m:60", push: true, text: false, email: false },
];

const iso = (d: DateTime) => d.toUTC().toISO({ suppressMilliseconds: true })!;

/** When it starts and ends, in UTC (an hour long without an end, or an end before the start; all day: midnight to 11:59 PM). */
export function personalEventTimes(e: Pick<PersonalEvent, "date" | "start_time" | "end_time" | "timezone" | "all_day">): { starts: string; ends: string } {
  if (e.all_day) {
    const day = DateTime.fromISO(e.date, { zone: e.timezone });
    return { starts: iso(day.startOf("day")), ends: iso(day.set({ hour: 23, minute: 59 })) };
  }
  const start = DateTime.fromISO(`${e.date}T${e.start_time}`, { zone: e.timezone });
  let end = e.end_time ? DateTime.fromISO(`${e.date}T${e.end_time}`, { zone: e.timezone }) : start.plus({ hours: 1 });
  if (!end.isValid || end <= start) end = start.plus({ hours: 1 });
  return { starts: iso(start), ends: iso(end) };
}

/** When its reminders count back from: its start, or 9 AM on an all-day event's day. */
export function personalReminderAnchor(e: PersonalEvent): string {
  return e.all_day ? iso(DateTime.fromISO(`${e.date}T09:00`, { zone: e.timezone })) : personalEventTimes(e).starts;
}

export function getPersonalEvent(memberId: number, id: number): PersonalEvent | undefined {
  return db().prepare("SELECT * FROM personal_events WHERE id = ? AND member_id = ?").get(id, memberId) as PersonalEvent | undefined;
}

/** Saves an event (new when id is null). Returns its id, or null if it isn't theirs. */
export function savePersonalEvent(
  memberId: number,
  id: number | null,
  e: {
    title: string;
    notes: string;
    location: string;
    date: string;
    start_time: string;
    end_time: string | null;
    all_day: boolean;
    timezone: string;
    reminders: TodoReminder[];
    repeat?: { pattern: Pattern; until: string | null } | null;
  },
): number | null {
  const reminders = storeReminders(memberId, e.reminders);
  const d = db();
  const values = [
    e.title,
    e.notes,
    e.location,
    e.date,
    e.all_day ? "00:00" : e.start_time,
    e.all_day ? null : e.end_time,
    e.all_day ? 1 : 0,
    e.timezone,
    reminders,
    e.repeat?.pattern ?? null,
    e.repeat?.until ?? null,
  ];
  if (id) {
    const changed = d
      .prepare(
        "UPDATE personal_events SET title = ?, notes = ?, location = ?, date = ?, start_time = ?, end_time = ?, all_day = ?, timezone = ?, reminders = ?, repeat = ?, repeat_until = ? WHERE id = ? AND member_id = ?",
      )
      .run(...values, id, memberId).changes;
    return changed ? id : null;
  }
  return Number(
    d
      .prepare("INSERT INTO personal_events (member_id, title, notes, location, date, start_time, end_time, all_day, timezone, reminders, repeat, repeat_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
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
  const from = day(fromUtc, -1);
  const to = day(toUtc, 1);
  const rows = personalRowsBetween("e.member_id = ?", [memberId], from, to).flatMap((e) => occurrences(e, from, to));
  return rows
    .map((e) => ({ e, ...personalEventTimes(e) }))
    .filter(({ starts, ends }) => starts < toUtc && ends >= fromUtc)
    .sort((a, b) => a.starts.localeCompare(b.starts))
    .map(({ e, starts, ends }) => ({
      // Each date of a repeating event is its own entry.
      id: e.repeat ? -(e.id * 100000 + (Number(e.date.replace(/-/g, "")) % 100000)) : -e.id,
      personal_event_id: e.id,
      personal_date: e.repeat ? e.date : undefined,
      all_day: e.all_day,
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
export const eventHref = (e: Pick<EventRow, "id" | "personal_event_id" | "personal_date" | "invited_meeting_id">) =>
  e.personal_event_id ? `/calendar/mine/${e.personal_event_id}${e.personal_date ? `?on=${e.personal_date}` : ""}` : e.invited_meeting_id ? `/meetings/${e.invited_meeting_id}` : `/calendar/${e.id}`;
