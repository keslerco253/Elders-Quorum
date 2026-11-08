import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-fill-"));

describe("pasting talk links", () => {
  it("fills the next open Sundays, skipping any already filled or a conference", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO lessons (ward_id, date, kind, url, title) VALUES
        (1, '2026-11-01', 'talk', 'https://x/a', 'Already here'),
        (1, '2026-11-08', 'talk', '', ''),
        (1, '2026-11-15', 'talk', 'https://x/b', 'Filled'),
        (1, '2026-11-22', 'talk', '', ''),
        (1, '2026-11-29', 'talk', '', 'Typed in by hand'),
        (1, '2026-12-06', 'stake_conference', '', ''),
        (1, '2026-12-13', 'talk', '', ''),
        (1, '2026-12-20', 'talk', 'https://x/old', '');
    `);
    void d;
    const { openLessonSundays } = await import("@/lib/lessons");
    // What's there now counts: a link left from a talk that was moved or cleared (no title) is open.
    expect(openLessonSundays(1, "2026-10-28").map((l) => l.date)).toEqual(["2026-11-08", "2026-11-22", "2026-12-13", "2026-12-20"]);
    // Sundays already past aren't filled.
    expect(openLessonSundays(1, "2026-11-10").map((l) => l.date)).toEqual(["2026-11-22", "2026-12-13", "2026-12-20"]);
    const { fallbackTitle } = await import("@/lib/talk-info");
    expect(fallbackTitle("https://www.churchofjesuschrist.org/study/general-conference/2025/10/57nelson?lang=eng")).toBe("General Conference talk, October 2025");
  });
});

describe("General Conference Sundays", () => {
  it("are the first Sunday of April and October, and get marked when blank", async () => {
    const { isGeneralConferenceSunday } = await import("@/lib/time");
    expect(isGeneralConferenceSunday("2027-04-04")).toBe(true);
    expect(isGeneralConferenceSunday("2027-04-11")).toBe(false);
    expect(isGeneralConferenceSunday("2026-10-04")).toBe(true);
    expect(isGeneralConferenceSunday("2027-03-07")).toBe(false);
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO lessons (ward_id, date, kind, url, title) VALUES (1, '2027-03-28', 'talk', '', ''), (1, '2027-04-04', 'talk', '', ''), (1, '2027-10-03', 'talk', 'https://x', 'Kept');
    `);
    const { markGeneralConferences } = await import("@/lib/lessons");
    expect(markGeneralConferences(1, "2027-01-01")).toBe(1);
    expect(d.prepare("SELECT date, kind FROM lessons ORDER BY date").all()).toEqual([
      { date: "2027-03-28", kind: "talk" },
      { date: "2027-04-04", kind: "general_conference" },
      // One someone already filled is left alone.
      { date: "2027-10-03", kind: "talk" },
    ]);
  });
});

describe("5th Sundays", () => {
  it("become 5th Sunday lessons, aren't filled with talks, and can need no teacher", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO lessons (id, ward_id, date, kind, url, title) VALUES
        (1, 1, '2026-11-22', 'talk', '', ''),
        (2, 1, '2026-11-29', 'talk', '', ''),
        (3, 1, '2027-01-31', 'talk', '', ''),
        (4, 1, '2027-05-30', 'talk', 'https://x/a', 'A talk put on by hand');
    `);
    const { markFifthSundays, openLessonSundays } = await import("@/lib/lessons");
    expect(markFifthSundays(1, "2026-11-01")).toBe(2);
    expect(d.prepare("SELECT id, fifth FROM lessons ORDER BY id").all()).toEqual([
      { id: 1, fifth: null },
      { id: 2, fifth: 1 },
      { id: 3, fifth: 1 },
      { id: 4, fifth: null },
    ]);
    expect(openLessonSundays(1, "2026-11-01").map((l) => l.date)).toEqual(["2026-11-22"]);
    // Made a talk Sunday by hand: it stays one.
    d.prepare("UPDATE lessons SET fifth = 0 WHERE id = 3").run();
    expect(markFifthSundays(1, "2026-11-01")).toBe(0);
    expect(openLessonSundays(1, "2026-11-01").map((l) => l.date)).toEqual(["2026-11-22", "2027-01-31"]);
    // No teacher needed: never "Teacher needed", even after someone said they can't.
    d.prepare("INSERT INTO members (id, name, display_name) VALUES (9, 'T', 'T')").run();
    d.prepare("UPDATE lessons SET date = date('now', '+20 days') WHERE id = 2").run();
    d.prepare("INSERT INTO lesson_declines (lesson_id, member_id) VALUES (2, 9)").run();
    const { teacherNeededLessons } = await import("@/lib/admin-counts");
    expect(teacherNeededLessons(1).map((l) => l.id)).toEqual([2]);
    d.prepare("UPDATE lessons SET no_teacher = 1 WHERE id = 2").run();
    expect(teacherNeededLessons(1)).toEqual([]);
  });
});
