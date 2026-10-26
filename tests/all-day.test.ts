import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db, useTestDb } from "@/lib/db";
import { allDayRange, allDayText, icsFor, reminderAnchor } from "@/lib/events";
import { collectDue } from "@/lib/scheduler";
import { personalEventsBetween, savePersonalEvent } from "@/lib/personal-events";
import type { EventRow } from "@/lib/types";

const TZ = "America/Boise";
const at = (local: string) => DateTime.fromISO(local, { zone: TZ }).toUTC();

describe("all-day events", () => {
  it("run from midnight to 11:59 PM of their days and read as All day", () => {
    const one = allDayRange("2026-11-05", null, TZ);
    expect(one).toEqual({ start: "2026-11-05T07:00:00Z", end: "2026-11-06T06:59:00Z" });
    expect(allDayText({ starts_at: one.start, ends_at: one.end }, TZ)).toBe("Thu, Nov 5 · All day");
    const three = allDayRange("2026-11-05", "2026-11-07", TZ);
    expect(allDayText({ starts_at: three.start, ends_at: three.end }, TZ)).toBe("Thu, Nov 5 – Sat, Nov 7");
    expect(reminderAnchor({ starts_at: one.start, all_day: 1 }, TZ)).toBe("2026-11-05T16:00:00Z");
  });

  it("are whole days in calendar files, with alerts counted from 9 AM", () => {
    const r = allDayRange("2026-11-05", null, TZ);
    const e = { id: 9, org_id: 1, title: "Food drive", description: "", location: "", starts_at: r.start, ends_at: r.end, all_day: 1 } as EventRow;
    const ics = icsFor(e, [60, 1440], "example.org", TZ);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261105");
    expect(ics).toContain("DTEND;VALUE=DATE:20261106");
    expect(ics).toContain("TRIGGER:PT480M");
    expect(ics).toContain("TRIGGER:-PT900M");
  });

  it("send reminders counted from 9 AM, for ward and personal events", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
    `);
    const r = allDayRange("2026-11-05", null, TZ);
    db().prepare("INSERT INTO events (org_id, title, starts_at, ends_at, all_day, reminder_minutes) VALUES (1, 'Food drive', ?, ?, 1, 1440)").run(r.start, r.end);
    const ward = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("event:")).map((n) => n.payload.body);
    expect(ward("2026-11-04T08:59")).toEqual([]);
    expect(ward("2026-11-04T09:00")[0]).toContain("Thu, Nov 5 · All day");
    savePersonalEvent(1, null, { title: "Birthday", notes: "", location: "", date: "2026-11-05", start_time: "", end_time: null, all_day: true, timezone: TZ, reminders: [{ when: "m:60", push: true, text: false, email: false }] });
    expect(personalEventsBetween(1, "2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z")[0]).toMatchObject({ all_day: 1, starts_at: r.start });
    const mine = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("pevent:"));
    expect(mine("2026-11-05T07:59")).toEqual([]);
    expect(mine("2026-11-05T08:00")[0].payload.body).toBe("Thu, Nov 5 · All day");
  });
});
