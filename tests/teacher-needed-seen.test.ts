import { describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { markTeacherNeedsSeen, teacherNeededLessons } from "@/lib/admin-counts";

describe("a teacher can't teach", () => {
  it("counts for each leader until they've seen it, and again after a new no", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'F', 'First', 'f@x.com', 'presidency'), (3, 1, 'T', 'Teacher', 't@x.com', 'member');
      INSERT INTO lessons (id, ward_id, date, kind, title) VALUES (10, 1, date('now', '+10 days'), 'talk', 'A talk');
    `);
    const d = db();
    d.prepare("INSERT INTO lesson_declines (lesson_id, member_id, reason, created_at) VALUES (10, 3, 'Away', datetime('now', '-1 minute'))").run();
    expect(teacherNeededLessons(1).map((l) => l.id)).toEqual([10]);
    expect(teacherNeededLessons(1, { unseenBy: 1 }).map((l) => l.id)).toEqual([10]);
    markTeacherNeedsSeen(1, [10]);
    // Seen by this leader: not counted for them, still for the other, still listed.
    expect(teacherNeededLessons(1, { unseenBy: 1 })).toEqual([]);
    expect(teacherNeededLessons(1, { unseenBy: 2 }).map((l) => l.id)).toEqual([10]);
    expect(teacherNeededLessons(1).map((l) => l.id)).toEqual([10]);
    // Someone else says no later: it counts again.
    d.prepare("UPDATE need_seen SET seen_at = datetime('now', '-30 seconds')").run();
    d.prepare("INSERT INTO lesson_declines (lesson_id, member_id, reason) VALUES (10, 2, 'Sick')").run();
    expect(teacherNeededLessons(1, { unseenBy: 1 }).map((l) => l.id)).toEqual([10]);
  });
});
