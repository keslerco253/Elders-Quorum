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
        (1, '2026-12-13', 'talk', '', '');
    `);
    void d;
    const { openLessonSundays } = await import("@/lib/lessons");
    expect(openLessonSundays(1, "2026-10-28").map((l) => l.date)).toEqual(["2026-11-08", "2026-11-22", "2026-12-13"]);
    // Sundays already past aren't filled.
    expect(openLessonSundays(1, "2026-11-10").map((l) => l.date)).toEqual(["2026-11-22", "2026-12-13"]);
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
