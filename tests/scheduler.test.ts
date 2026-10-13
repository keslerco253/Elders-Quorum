import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { useTestDb } from "@/lib/db";
import { collectDue } from "@/lib/scheduler";
import { claimOnce } from "@/lib/notify";

const at = (local: string) => DateTime.fromISO(local, { zone: "America/Boise" }).toUTC();

describe("scheduler", () => {
  beforeEach(() => {
    const d = useTestDb();
    d.exec(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward Elders Quorum', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role, last_login_at) VALUES
        (1, 1, 'Pres, Joe', 'Joe Pres', 'joe@x.com', 'presidency', '2026-10-01'),
        (2, 1, 'Mem, Sam', 'Sam Mem', 'sam@x.com', 'member', '2026-10-01'),
        (3, 1, 'New, Ned', 'Ned New', 'ned@x.com', 'member', NULL);
      INSERT INTO lessons (ward_id, date, kind, title, speaker, teacher_id) VALUES
        (1, '2026-10-18', 'talk', 'Abide in My Love', 'Elder Christofferson', 2),
        (1, '2026-10-25', 'stake_conference', '', '', NULL);
      INSERT INTO events (ward_id, title, starts_at, ends_at, reminder_minutes, presidency_only) VALUES
        (1, 'Presidency meeting', '2026-10-15T01:00:00Z', '2026-10-15T02:00:00Z', 1440, 1);
      INSERT INTO todos (ward_id, title, assignee_id, due_date) VALUES (1, 'Call the bishop', 1, '2026-10-17');
    `);
  });

  it("sends the Sunday 7 PM reminder for next Sunday's lesson to everyone who joined", () => {
    expect(collectDue(at("2026-10-11T18:59")).filter((n) => n.key.startsWith("lesson"))).toEqual([]);
    const due = collectDue(at("2026-10-11T19:00")).filter((n) => n.key.startsWith("lesson"));
    expect(due[0].key).toBe("lesson-sun:1:2026-10-18");
    expect(due[0].payload.title).toBe("This Sunday's lesson: Abide in My Love");
    // Everyone except the teacher, who gets their own reminder.
    expect(due[0].recipients.map((r) => r.id).sort()).toEqual([1, 3]);
  });

  it("reminds the teacher Sunday 7 PM and Saturday 8 AM before their lesson", () => {
    const sun = collectDue(at("2026-10-11T19:00")).filter((n) => n.key.startsWith("lesson-teacher"));
    expect(sun).toHaveLength(1);
    expect(sun[0].key).toBe("lesson-teacher-sun:1:2026-10-18:2");
    expect(sun[0].recipients.map((r) => r.id)).toEqual([2]);
    expect(sun[0].payload.title).toBe("You're teaching this Sunday");
    expect(sun[0].payload.body).toContain('"Abide in My Love" by Elder Christofferson.');
    expect(sun[0].payload.body).toContain("Tap to add them");

    const sat = collectDue(at("2026-10-17T08:00")).filter((n) => n.key.startsWith("lesson-teacher"));
    expect(sat.map((n) => n.payload.title)).toEqual(["You're teaching tomorrow"]);
    expect(collectDue(at("2026-10-17T07:59")).filter((n) => n.key.startsWith("lesson-teacher"))).toEqual([]);
  });

  it("tells the teacher where their notes stand", async () => {
    const { db } = await import("@/lib/db");
    db().exec("INSERT INTO lesson_notes (lesson_id, author_id, body, status) SELECT id, 2, 'My notes', 'pending' FROM lessons WHERE date = '2026-10-18'");
    expect(collectDue(at("2026-10-17T08:00")).find((n) => n.key.startsWith("lesson-teacher"))!.payload.body).toContain("waiting for the presidency");
    db().exec("UPDATE lesson_notes SET status = 'approved', published_body = 'My notes'");
    expect(collectDue(at("2026-10-17T08:00")).find((n) => n.key.startsWith("lesson-teacher"))!.payload.body).toContain("posted for the quorum");
  });

  it("sends the Saturday 8 AM reminder for tomorrow", () => {
    const due = collectDue(at("2026-10-17T08:05")).filter((n) => n.key.startsWith("lesson"));
    expect(due.map((d) => d.key)).toEqual(["lesson-sat:1:2026-10-18", "lesson-teacher-sat:1:2026-10-18:2"]);
    expect(due[0].payload.title).toBe("Tomorrow's lesson: Abide in My Love");
  });

  it("announces conference Sundays instead of a lesson", () => {
    const due = collectDue(at("2026-10-18T20:00")).filter((n) => n.key.startsWith("lesson"));
    expect(due[0].payload.title).toBe("This Sunday: Stake Conference");
  });

  it("reminds presidency-only events to admins only", () => {
    const due = collectDue(at("2026-10-13T19:30")).filter((n) => n.key.startsWith("event"));
    expect(due).toHaveLength(1);
    expect(due[0].recipients.map((r) => r.id)).toEqual([1]);
    expect(collectDue(at("2026-10-13T18:00")).filter((n) => n.key.startsWith("event"))).toEqual([]);
  });

  it("reminds to-do assignees the day before and the day of", () => {
    expect(collectDue(at("2026-10-16T09:00")).filter((n) => n.key.startsWith("todo")).map((n) => n.payload.title)).toEqual(["Assignment due tomorrow"]);
    expect(collectDue(at("2026-10-17T09:00")).filter((n) => n.key.startsWith("todo")).map((n) => n.payload.title)).toEqual(["Assignment due today"]);
    expect(collectDue(at("2026-10-17T07:00")).filter((n) => n.key.startsWith("todo"))).toEqual([]);
  });

  it("claims each key once", () => {
    expect(claimOnce("x")).toBe(true);
    expect(claimOnce("x")).toBe(false);
  });
});
