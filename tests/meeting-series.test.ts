import { describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { createMeetingSeries, fillMeetingSeries, stopMeetingSeries } from "@/lib/meeting-series";

const TZ = "America/Boise";
const dates = () => (db().prepare("SELECT date FROM meetings WHERE series_id IS NOT NULL ORDER BY date").all() as { date: string }[]).map((r) => r.date);

describe("repeating presidency meetings", () => {
  it("keeps the next two scheduled, on the calendar, and stops when asked", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
    `);
    // The first Sunday of every month, from Sunday, Dec 6, 2026.
    const first = createMeetingSeries(1, { pattern: "monthly_nth", start: "2026-12-06", until: null, count: null, time: "19:00", title: "", location: "Marks Home", reminders: [120, 1440] }, 1, TZ);
    expect(first).toBeTruthy();
    expect(dates()).toEqual(["2026-12-06", "2027-01-03"]);
    const ev = db().prepare("SELECT e.location, e.reminder_minutes, e.reminder2_minutes FROM meetings m JOIN events e ON e.id = m.event_id WHERE m.id = ?").get(first) as Record<string, unknown>;
    expect(ev).toEqual({ location: "Marks Home", reminder_minutes: 120, reminder2_minutes: 1440 });
    // Nothing more while two are ahead; once one is past, the next is added.
    const id = (db().prepare("SELECT id FROM meeting_series").get() as { id: number }).id;
    expect(fillMeetingSeries(id, TZ, "2026-11-20")).toEqual([]);
    fillMeetingSeries(id, TZ, "2026-12-07");
    expect(dates()).toEqual(["2026-12-06", "2027-01-03", "2027-02-07"]);
    // A meeting deleted from the series isn't made again.
    db().prepare("DELETE FROM meetings WHERE date = '2027-02-07'").run();
    fillMeetingSeries(id, TZ, "2027-01-04");
    expect(dates()).toEqual(["2026-12-06", "2027-01-03", "2027-03-07", "2027-04-04"]);
    stopMeetingSeries(1, id);
    expect(fillMeetingSeries(id, TZ, "2027-03-08")).toEqual([]);
  });

  it("ends after a number of times", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
    `);
    createMeetingSeries(1, { pattern: "weekly", start: "2026-12-06", until: null, count: 3, time: "19:00", title: "", location: "", reminders: [null, null] }, 1, TZ);
    const id = (db().prepare("SELECT id FROM meeting_series").get() as { id: number }).id;
    fillMeetingSeries(id, TZ, "2026-12-14");
    fillMeetingSeries(id, TZ, "2026-12-21");
    expect(dates()).toEqual(["2026-12-06", "2026-12-13", "2026-12-20"]);
  });
});
