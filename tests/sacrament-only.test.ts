import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";

describe("a Sunday with only sacrament meeting (Easter, Christmas)", () => {
  it("keeps every lesson, and its teacher, volunteers and comments, when the list of Sunday kinds grows", async () => {
    const { migrate } = await import("@/lib/db");
    const Database = (await import("better-sqlite3")).default;
    const d = new Database(":memory:");
    d.pragma("foreign_keys = ON");
    migrate(d, 107);
    d.exec(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO orgs (id, ward_id, name, kind) VALUES (1, 1, 'Elders Quorum', 'group');
      INSERT INTO members (id, name, display_name, email) VALUES (1, 'T', 'Teacher', 't@x'), (2, 'V', 'Volunteer', 'v@x');
      INSERT INTO lessons (id, org_id, date, kind, title, teacher_id, topic, fifth) VALUES
        (1, 1, '2027-03-21', 'talk', 'Hope', 1, 0, NULL), (2, 1, '2027-04-04', 'general_conference', '', NULL, 0, NULL);
      INSERT INTO lesson_volunteers (lesson_id, member_id) VALUES (1, 2);
      INSERT INTO comments (lesson_id, member_id, body) VALUES (1, 2, 'Great talk');
    `);
    migrate(d);
    expect(d.prepare("SELECT id, kind, title, teacher_id FROM lessons ORDER BY id").all()).toEqual([
      { id: 1, kind: "talk", title: "Hope", teacher_id: 1 },
      { id: 2, kind: "general_conference", title: "", teacher_id: null },
    ]);
    expect(d.prepare("SELECT COUNT(*) AS n FROM lesson_volunteers").get()).toEqual({ n: 1 });
    expect(d.prepare("SELECT body FROM comments").get()).toEqual({ body: "Great talk" });
    d.prepare("UPDATE lessons SET kind = 'sacrament_only' WHERE id = 1").run();
    expect(d.prepare("SELECT kind FROM lessons WHERE id = 1").get()).toEqual({ kind: "sacrament_only" });
    expect(d.pragma("foreign_key_check")).toEqual([]);
    // Deleting a lesson still takes its volunteers and comments with it.
    d.prepare("DELETE FROM lessons WHERE id = 1").run();
    expect(d.prepare("SELECT COUNT(*) AS n FROM comments").get()).toEqual({ n: 0 });
  });

  it("is shown as Sacrament meeting only, and its reminder says there's no lesson", async () => {
    const { noLessonLabel } = await import("@/lib/types");
    expect(noLessonLabel("sacrament_only")).toBe("Sacrament meeting only");
    expect(noLessonLabel("talk")).toBeNull();
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role, last_login_at) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency', '2026-10-01');
      INSERT INTO lessons (id, ward_id, date, kind) VALUES (9, 1, '2027-03-28', 'talk');
    `);
    d.prepare("UPDATE lessons SET kind = 'sacrament_only' WHERE id = 9").run();
    const { collectDue } = await import("@/lib/scheduler");
    const due = collectDue(DateTime.fromISO("2027-03-21T19:00", { zone: "America/Boise" }).toUTC()).find((n) => n.key.startsWith("lesson-"));
    expect(due?.payload.title).toBe("This Sunday: sacrament meeting");
    expect(due?.payload.body).toContain("We hope to see you at sacrament meeting.");
  });
});
