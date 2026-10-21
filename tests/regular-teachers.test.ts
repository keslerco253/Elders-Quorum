import { beforeEach, describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { fillRegularTeachers, saveRegularTeachers, weekOfMonth, weeksText } from "@/lib/regular-teachers";

const teacherOn = (date: string) => (db().prepare("SELECT teacher_id FROM lessons WHERE date = ?").get(date) as { teacher_id: number | null }).teacher_id;

describe("regular teachers", () => {
  beforeEach(() => {
    // November 2026 has five Sundays: 1, 8, 15, 22, 29.
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'S', 'Smith', 's@x.com', 'member'), (3, 1, 'J', 'Jones', 'j@x.com', 'member');
      INSERT INTO lessons (ward_id, date, kind) VALUES (1, '2026-11-01', 'talk'), (1, '2026-11-08', 'talk'), (1, '2026-11-15', 'talk'), (1, '2026-11-22', 'talk'), (1, '2026-11-29', 'talk'),
        (1, '2026-12-06', 'talk'), (1, '2026-12-13', 'talk');
    `);
  });

  it("knows which Sunday of the month it is", () => {
    expect(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"].map(weekOfMonth)).toEqual([1, 2, 3, 4, 5]);
    expect(weeksText([4, 2])).toBe("2nd and 4th Sundays");
    expect(weeksText([3])).toBe("3rd Sunday");
  });

  it("fills one teacher per Sunday, never 5th Sundays", () => {
    const r = saveRegularTeachers(1, [null, 2, 3, 2], "2026-10-21");
    expect(r.filled).toBe(4);
    expect(r.added.map((a) => [a.id, a.all])).toEqual([[2, [2, 4]], [3, [3]]]);
    expect(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29", "2026-12-13"].map(teacherOn)).toEqual([null, 2, 3, 2, null, 2]);
  });

  it("doesn't refill a lesson the teacher was taken off or declined", () => {
    saveRegularTeachers(1, [null, 2, null, null], "2026-10-21");
    db().prepare("UPDATE lessons SET teacher_id = NULL, regular_done = 1 WHERE date = '2026-11-08'").run();
    expect(fillRegularTeachers(1, "2026-10-21")).toBe(0);
    expect(teacherOn("2026-11-08")).toBeNull();
  });

  it("moves upcoming automatic lessons when a Sunday's teacher changes, and leaves hand-set ones", () => {
    saveRegularTeachers(1, [2, null, null, null], "2026-10-21");
    db().prepare("UPDATE lessons SET teacher_id = 1, teacher_auto = 0 WHERE date = '2026-12-06'").run();
    const r = saveRegularTeachers(1, [3, null, null, null], "2026-10-21");
    expect(teacherOn("2026-11-01")).toBe(3);
    expect(teacherOn("2026-12-06")).toBe(1);
    expect(r.removed).toEqual([{ id: 2, weeks: [1] }]);
  });
});

describe("assigned topics", () => {
  it("skips topic Sundays when pasting talk links, and fills them with regular teachers", async () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (2, 1, 'S', 'Smith', 's@x.com', 'member');
      INSERT INTO lessons (ward_id, date, kind) VALUES (1, '2026-11-01', 'talk'), (1, '2026-11-08', 'talk');
    `);
    db().prepare("UPDATE lessons SET topic = 1, title = 'Ministering' WHERE date = '2026-11-08'").run();
    db().prepare("UPDATE lessons SET title = '' WHERE date = '2026-11-08'").run();
    const { openLessonSundays } = await import("@/lib/lessons");
    expect(openLessonSundays(1, "2026-10-21").map((l) => l.date)).toEqual(["2026-11-01"]);
    saveRegularTeachers(1, [null, 2, null, null], "2026-10-21");
    expect(teacherOn("2026-11-08")).toBe(2);
  });
});
