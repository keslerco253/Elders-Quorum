import { DateTime } from "luxon";
import { db } from "./db";
import { occurrenceDates, type Pattern, type Recurrence } from "./recurrence";
import { orgTimezone } from "./orgs";

// Repeating events are stored as a series plus one ordinary event per date.
// Dates are created a year ahead; the daily scheduler keeps extending series
// that have no end.

export const HORIZON_DAYS = 365;

export interface SeriesRow {
  id: number;
  org_id: number;
  pattern: Pattern;
  start_date: string;
  start_time: string;
  duration_minutes: number;
  /** All day (from midnight, a day or more less a minute). */
  all_day?: number;
  until_date: string | null;
  max_count: number | null;
  title: string;
  description: string;
  location: string;
  presidency_only: number;
  rsvp_enabled: number;
  reminder_minutes: number | null;
  reminder2_minutes: number | null;
  flyer_file: string | null;
  flyer_name: string | null;
  generated_until: string | null;
  created_by: number | null;
  invited: string;
}

export type SeriesInput = Omit<SeriesRow, "id" | "generated_until">;

export const recurrenceOf = (s: Pick<SeriesRow, "pattern" | "start_date" | "until_date" | "max_count">): Recurrence => ({
  pattern: s.pattern,
  start: s.start_date,
  until: s.until_date,
  count: s.max_count,
});

export function getSeries(orgId: number, id: number | null | undefined): SeriesRow | undefined {
  if (!id) return undefined;
  return db().prepare("SELECT * FROM event_series WHERE id = ? AND org_id = ?").get(id, orgId) as SeriesRow | undefined;
}

const tzOf = orgTimezone;

/** Creates the series' events after generated_until, up to the horizon. Returns how many were added. */
export function extendSeries(s: SeriesRow, today = DateTime.now().setZone(tzOf(s.org_id)).toISODate()!): number {
  const tz = tzOf(s.org_id);
  const to = DateTime.fromISO(today).plus({ days: HORIZON_DAYS }).toISODate()!;
  const from = s.generated_until ? DateTime.fromISO(s.generated_until).plus({ days: 1 }).toISODate()! : s.start_date;
  if (from > to) return 0;
  const d = db();
  const ins = d.prepare(
    "INSERT INTO events (org_id, title, description, location, starts_at, ends_at, presidency_only, rsvp_enabled, reminder_minutes, reminder2_minutes, flyer_file, flyer_name, created_by, series_id, invited, all_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const dates = occurrenceDates(recurrenceOf(s), from, to);
  d.transaction(() => {
    for (const date of dates) {
      const start = DateTime.fromISO(`${date}T${s.start_time}`, { zone: tz });
      ins.run(
        s.org_id,
        s.title,
        s.description,
        s.location,
        start.toUTC().toISO({ suppressMilliseconds: true }),
        start.plus({ minutes: s.duration_minutes }).toUTC().toISO({ suppressMilliseconds: true }),
        s.presidency_only,
        s.rsvp_enabled,
        s.reminder_minutes,
        s.reminder2_minutes,
        s.flyer_file,
        s.flyer_name,
        s.created_by,
        s.id,
        s.invited ?? "",
        s.all_day ?? 0,
      );
    }
    d.prepare("UPDATE event_series SET generated_until = ? WHERE id = ?").run(to, s.id);
  })();
  return dates.length;
}

/** Starts a series. If firstEventId is given, that event becomes its first date (already exists). */
export function createSeries(input: SeriesInput, firstEventId?: number): number {
  const d = db();
  const id = Number(
    d
      .prepare(
        `INSERT INTO event_series (org_id, pattern, start_date, start_time, duration_minutes, until_date, max_count, title, description, location, presidency_only, rsvp_enabled, reminder_minutes, reminder2_minutes, flyer_file, flyer_name, created_by, generated_until, invited, all_day)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.org_id,
        input.pattern,
        input.start_date,
        input.start_time,
        input.duration_minutes,
        input.until_date,
        input.max_count,
        input.title,
        input.description,
        input.location,
        input.presidency_only,
        input.rsvp_enabled,
        input.reminder_minutes,
        input.reminder2_minutes,
        input.flyer_file,
        input.flyer_name,
        input.created_by,
        firstEventId ? input.start_date : null,
        input.invited ?? "",
        input.all_day ?? 0,
      ).lastInsertRowid,
  );
  if (firstEventId) d.prepare("UPDATE events SET series_id = ? WHERE id = ?").run(id, firstEventId);
  extendSeries(getSeries(input.org_id, id)!);
  return id;
}

/** Ends a series before a date: removes its events from then on and stops creating more. */
export function endSeriesBefore(s: SeriesRow, fromUtc: string, lastDate: string) {
  const d = db();
  d.transaction(() => {
    d.prepare("DELETE FROM events WHERE series_id = ? AND starts_at >= ?").run(s.id, fromUtc);
    d.prepare("UPDATE event_series SET until_date = ?, max_count = NULL WHERE id = ?").run(lastDate, s.id);
  })();
}

/** Keeps every open-ended series filled a year ahead. Run daily. */
export function extendAllSeries() {
  const rows = db().prepare("SELECT * FROM event_series").all() as SeriesRow[];
  let added = 0;
  for (const s of rows) added += extendSeries(s);
  return added;
}
