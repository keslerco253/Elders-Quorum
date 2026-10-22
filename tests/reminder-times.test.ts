import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db, useTestDb } from "@/lib/db";
import { collectDue } from "@/lib/scheduler";
import { DEFAULT_REMINDERS, reminderSettings, saveOrgReminderSettings } from "@/lib/reminder-settings";

const at = (local: string) => DateTime.fromISO(local, { zone: "America/Boise" }).toUTC();

describe("an organization's reminder times", () => {
  let org: number;
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role, last_login_at) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency', '2026-10-01'), (2, 1, 'T', 'Teacher', 't@x.com', 'member', '2026-10-01');
      INSERT INTO lessons (ward_id, date, kind, title, speaker, teacher_id) VALUES (1, '2026-11-01', 'talk', 'Abide', 'Elder C', 2);
    `);
    org = (db().prepare("SELECT org_id FROM lessons LIMIT 1").get() as { org_id: number }).org_id;
  });

  it("starts with the usual times", () => {
    expect(reminderSettings(org)).toEqual(DEFAULT_REMINDERS);
    const sun = collectDue(at("2026-10-25T19:00")).filter((n) => n.key.startsWith("lesson"));
    expect(sun.map((n) => n.key.split(":")[0]).sort()).toEqual(["lesson-sun", "lesson-teacher-sun"]);
  });

  it("sends lesson reminders when the presidency chose, and none to the teacher if turned off", () => {
    saveOrgReminderSettings(org, { ...DEFAULT_REMINDERS, lesson: [{ days: 4, time: "18:00" }], teacher: [] });
    const lessonKeys = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("lesson")).map((n) => n.key.split(":")[0]);
    expect(lessonKeys("2026-10-25T19:00")).toEqual([]); // no longer Sunday evening
    expect(lessonKeys("2026-10-28T17:59")).toEqual([]);
    expect(lessonKeys("2026-10-28T18:00")).toEqual(["lesson-d4-1800"]); // Wednesday 6 PM
    const [n] = collectDue(at("2026-10-28T18:00")).filter((x) => x.key.startsWith("lesson-d4"));
    expect(n.recipients.map((r) => r.id)).toEqual([1]); // not the teacher
  });

  it("times visit reminders and the morning hour as set", () => {
    const visit = (time: string | null) =>
      db().prepare("INSERT INTO planned_visits (org_id, member_id, date, time, type, created_by) VALUES (?, 2, '2026-11-05', ?, 'home', 1)").run(org, time);
    visit("19:00");
    saveOrgReminderSettings(org, { ...DEFAULT_REMINDERS, visitHours: 24 });
    const visits = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("visit-rem:"));
    expect(visits("2026-11-04T18:59")).toEqual([]);
    expect(visits("2026-11-04T19:00")).toHaveLength(1);
    saveOrgReminderSettings(org, { ...DEFAULT_REMINDERS, visitHours: 0 });
    expect(visits("2026-11-05T16:00")).toEqual([]);

    db().prepare("INSERT INTO todos (org_id, title, assignee_id, due_date) VALUES (?, 'Call', 1, '2026-11-06')").run(org);
    const todo = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("todo-"));
    expect(todo("2026-11-05T06:30")).toEqual([]);
    saveOrgReminderSettings(org, { ...DEFAULT_REMINDERS, morningHour: 6 });
    expect(todo("2026-11-05T06:30")).toHaveLength(1);
  });
});
