import { DateTime } from "luxon";
import { db } from "./db";
import { createMeeting } from "./meetings";
import { describeRecurrence, occurrenceDates, type Pattern } from "./recurrence";
import { todayIn } from "./time";

// Repeating presidency meetings, like the first Sunday of every month. Each date is an
// ordinary meeting (its own agenda, notes and reminders); the next two are always
// scheduled ahead, and more are added as those pass. A meeting deleted from the series
// isn't scheduled again (last_date is the latest one made).

export interface MeetingSeries {
  id: number;
  org_id: number;
  pattern: Pattern;
  start_date: string;
  until: string | null;
  count: number | null;
  time: string;
  title: string;
  location: string;
  reminder_minutes: number | null;
  reminder2_minutes: number | null;
  created_by: number | null;
  active: number;
  last_date: string | null;
}

/** How many of a series' meetings are scheduled ahead at a time. */
const AHEAD = 2;

const recurrence = (s: MeetingSeries) => ({ pattern: s.pattern, start: s.start_date, until: s.until, count: s.count });

export const seriesText = (s: MeetingSeries) => describeRecurrence(recurrence(s));

export function getMeetingSeries(orgId: number, id: number): MeetingSeries | undefined {
  return db().prepare("SELECT * FROM meeting_series WHERE id = ? AND org_id = ?").get(id, orgId) as MeetingSeries | undefined;
}

/** Schedules the series' next meetings (up to two ahead). Returns the ids made. */
export function fillMeetingSeries(seriesId: number, tz: string, today = todayIn(tz)): number[] {
  const s = db().prepare("SELECT * FROM meeting_series WHERE id = ?").get(seriesId) as MeetingSeries | undefined;
  if (!s || !s.active) return [];
  const ahead = (db().prepare("SELECT COUNT(*) AS n FROM meetings WHERE series_id = ? AND held_at IS NULL AND date >= ?").get(s.id, today) as { n: number }).n;
  const want = AHEAD - ahead;
  if (want <= 0) return [];
  const to = DateTime.fromISO(today).plus({ years: 1 }).toISODate()!;
  const dates = occurrenceDates(recurrence(s), today, to)
    .filter((d) => !s.last_date || d > s.last_date)
    .slice(0, want);
  const ids = dates.map((date) =>
    createMeeting(s.org_id, date, s.title, s.created_by ?? 0, {
      time: s.time,
      tz,
      location: s.location,
      reminders: [s.reminder_minutes, s.reminder2_minutes],
      seriesId: s.id,
    }),
  );
  if (dates.length) db().prepare("UPDATE meeting_series SET last_date = ? WHERE id = ?").run(dates.at(-1), s.id);
  // A series that has run its course (an end date or number of times) stops.
  else if (!occurrenceDates(recurrence(s), today, to).some((d) => !s.last_date || d > s.last_date)) db().prepare("UPDATE meeting_series SET active = 0 WHERE id = ?").run(s.id);
  return ids;
}

/** Starts repeating meetings and schedules the first ones. Returns the first meeting's id. */
export function createMeetingSeries(
  orgId: number,
  input: { pattern: Pattern; start: string; until: string | null; count: number | null; time: string; title: string; location: string; reminders: [number | null, number | null] },
  createdBy: number,
  tz: string,
): number | undefined {
  const id = Number(
    db()
      .prepare(
        `INSERT INTO meeting_series (org_id, pattern, start_date, until, count, time, title, location, reminder_minutes, reminder2_minutes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(orgId, input.pattern, input.start, input.until, input.count, input.time, input.title, input.location.trim().slice(0, 200), input.reminders[0], input.reminders[1], createdBy).lastInsertRowid,
  );
  return fillMeetingSeries(id, tz, input.start < todayIn(tz) ? todayIn(tz) : input.start)[0];
}

/** Stops repeating: meetings already scheduled stay. */
export function stopMeetingSeries(orgId: number, seriesId: number) {
  db().prepare("UPDATE meeting_series SET active = 0 WHERE id = ? AND org_id = ?").run(seriesId, orgId);
}

/** Keeps every repeating meeting scheduled ahead (once a day). Returns how many were added. */
export function extendAllMeetingSeries(): number {
  const rows = db()
    .prepare("SELECT s.id, w.timezone FROM meeting_series s JOIN orgs o ON o.id = s.org_id JOIN wards w ON w.id = o.ward_id WHERE s.active = 1 AND o.active = 1")
    .all() as { id: number; timezone: string }[];
  return rows.reduce((n, r) => n + fillMeetingSeries(r.id, r.timezone).length, 0);
}
