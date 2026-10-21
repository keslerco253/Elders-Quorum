import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { useTestDb } from "@/lib/db";
import { collectDue } from "@/lib/scheduler";
import { saveReminderSettings, getReminderSettings, dueForDate, dueForStart } from "@/lib/reminder-prefs";

const at = (local: string) => DateTime.fromISO(local, { zone: "America/Boise" }).toUTC();

describe("members' own reminders", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role, last_login_at) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency', '2026-10-01'),
        (2, 1, 'S', 'Sam', 's@x.com', 'member', '2026-10-01'),
        (3, 1, 'N', 'Ned', 'n@x.com', 'member', '2026-10-01');
      INSERT INTO lessons (ward_id, date, kind, title, speaker) VALUES (1, '2026-10-25', 'talk', 'Abide in My Love', 'Elder Christofferson');
      INSERT INTO events (ward_id, title, starts_at, ends_at, reminder_minutes) VALUES (1, 'Service project', '2026-10-24T16:00:00Z', '2026-10-24T18:00:00Z', 1440);
    `);
  });

  it("checks settings: up to 3 texts, valid timings only", () => {
    expect(saveReminderSettings(2, "lessons", "custom", [], true)).toMatch(/at least one/);
    const four = ["d:7@19:00", "d:4@19:00", "d:2@19:00", "d:1@08:00"].map((when) => ({ when, channel: "text" as const }));
    expect(saveReminderSettings(2, "lessons", "custom", four, true)).toMatch(/up to 3 text/);
    expect(saveReminderSettings(2, "lessons", "custom", [...four.slice(0, 3), { when: "d:1@08:00", channel: "push" }, { when: "bogus", channel: "push" }], true)).toBeNull();
    expect(getReminderSettings(2, "lessons").reminders).toHaveLength(4);
    // No permission to text: texts become app notifications.
    saveReminderSettings(3, "events", "custom", [{ when: "m:60", channel: "text" }], false);
    expect(getReminderSettings(3, "events")).toEqual({ mode: "custom", reminders: [{ when: "m:60", channel: "push" }] });
    saveReminderSettings(3, "events", "default", [], false);
    expect(getReminderSettings(3, "events")).toEqual({ mode: "default", reminders: [] });
  });

  it("works out when a reminder is due", () => {
    const local = (t: string) => DateTime.fromISO(t, { zone: "America/Boise" });
    expect(dueForDate("d:1@19:00", "2026-10-25", local("2026-10-24T18:59"))).toBe(false);
    expect(dueForDate("d:1@19:00", "2026-10-25", local("2026-10-24T19:00"))).toBe(true);
    expect(dueForDate("d:1@19:00", "2026-10-25", local("2026-10-25T02:00"))).toBe(false); // more than 6 hours late
    expect(dueForStart("m:60", "2026-10-24T16:00:00Z", at("2026-10-24T09:00"))).toBe(true);
    expect(dueForStart("m:60", "2026-10-24T16:00:00Z", at("2026-10-24T08:59"))).toBe(false);
  });

  it("sends a member's own lesson reminders instead of the scheduled ones, by the way they chose", () => {
    saveReminderSettings(2, "lessons", "custom", [{ when: "d:1@19:00", channel: "text" }], true);
    saveReminderSettings(3, "lessons", "off", [], true);
    // Sunday 7 PM: the scheduled reminder goes to everyone else.
    const sun = collectDue(at("2026-10-18T19:00")).filter((n) => n.key.startsWith("lesson"));
    expect(sun.map((n) => n.recipients.map((r) => r.id))).toEqual([[1]]);
    // Saturday 7 PM: Sam's own, as a text.
    const mine = collectDue(at("2026-10-24T19:00")).filter((n) => n.key.startsWith("lesson-mine"));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ only: "text", recipients: [{ id: 2 }] });
    expect(mine[0].payload.title).toBe("Tomorrow's lesson: Abide in My Love");
  });

  it("sends a member's own event reminders, and leaves them out of the scheduled one", () => {
    saveReminderSettings(2, "events", "custom", [{ when: "m:60", channel: "push" }, { when: "m:180", channel: "text" }], true);
    const dayBefore = collectDue(at("2026-10-23T10:00")).filter((n) => n.key.startsWith("event"));
    expect(dayBefore.map((n) => n.recipients.map((r) => r.id).sort())).toEqual([[1, 3]]);
    const threeHours = collectDue(at("2026-10-24T07:00")).filter((n) => n.key.startsWith("event-mine"));
    expect(threeHours.map((n) => [n.only, n.recipients[0].id])).toEqual([["text", 2]]);
    // An hour before: the 1-hour one too (the 3-hour one, still listed, was already sent once: each key goes once).
    const oneHour = collectDue(at("2026-10-24T09:00")).filter((n) => n.key.startsWith("event-mine"));
    expect(oneHour.map((n) => [n.only, n.recipients[0].id]).sort()).toEqual([["push", 2], ["text", 2]]);
    expect(new Set(oneHour.map((n) => n.key)).size).toBe(2);
  });
});
