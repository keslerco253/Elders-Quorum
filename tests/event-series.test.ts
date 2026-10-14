import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { useTestDb } from "@/lib/db";
import { createSeries, endSeriesBefore, extendSeries, getSeries, type SeriesInput } from "@/lib/event-series";

let d: Database.Database;
const base: SeriesInput = {
  org_id: 1,
  pattern: "monthly_nth",
  start_date: "2026-10-16",
  start_time: "19:00",
  duration_minutes: 120,
  until_date: null,
  max_count: null,
  title: "Ward temple night",
  description: "",
  location: "Boise Temple",
  presidency_only: 0,
  rsvp_enabled: 1,
  reminder_minutes: 1440,
  created_by: 1,
};
const events = (seriesId: number) => d.prepare("SELECT starts_at, ends_at, title FROM events WHERE series_id = ? ORDER BY starts_at").all(seriesId) as { starts_at: string; ends_at: string; title: string }[];

describe("repeating event series", () => {
  beforeEach(() => {
    d = useTestDb("INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise'); INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'P', 'p@x', 'presidency');");
  });

  it("creates the third Friday at 7 PM local time, a year ahead, through daylight saving", () => {
    const id = createSeries({ ...base });
    const list = events(id);
    expect(list.length).toBeGreaterThanOrEqual(12);
    // October (daylight time, UTC-6) and November (standard time, UTC-7) are both 7 PM in Boise.
    expect(list[0]).toMatchObject({ starts_at: "2026-10-17T01:00:00Z", ends_at: "2026-10-17T03:00:00Z", title: "Ward temple night" });
    expect(list[1].starts_at).toBe("2026-11-21T02:00:00Z");
    // Extending again doesn't duplicate.
    expect(extendSeries(getSeries(1, id)!)).toBe(0);
  });

  it("respects an end, and can end early from a date", () => {
    const id = createSeries({ ...base, max_count: 3 });
    expect(events(id)).toHaveLength(3);
    const open = createSeries({ ...base, pattern: "weekly" });
    endSeriesBefore(getSeries(1, open)!, "2026-11-01T00:00:00Z", "2026-10-31");
    const left = events(open);
    expect(left.every((e) => e.starts_at < "2026-11-01")).toBe(true);
    expect(left).toHaveLength(3); // Oct 16, 23, 30
    expect(extendSeries(getSeries(1, open)!)).toBe(0);
  });

  it("can turn an existing event into the first date of a series", () => {
    const first = Number(
      d.prepare("INSERT INTO events (org_id, title, starts_at, ends_at) VALUES (1, 'Ward temple night', '2026-10-17T01:00:00Z', '2026-10-17T03:00:00Z')").run().lastInsertRowid,
    );
    const id = createSeries({ ...base, max_count: 2 }, first);
    expect(events(id).map((e) => e.starts_at)).toEqual(["2026-10-17T01:00:00Z", "2026-11-21T02:00:00Z"]);
    expect((d.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n).toBe(2);
  });
});
