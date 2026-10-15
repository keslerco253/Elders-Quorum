import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-planned-"));
process.env.DATA_DIR = dir;

describe("planned visits", () => {
  let pv: typeof import("@/lib/planned-visits");
  let collectDue: typeof import("@/lib/scheduler").collectDue;
  let runRetention: typeof import("@/lib/retention").runRetention;
  let d: import("better-sqlite3").Database;

  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres Person', 'p@test.local', 'presidency'),
        (2, 1, 'C', 'Couns Person', 'c@test.local', 'presidency'),
        (3, 1, 'M', 'Member Person', 'm@test.local', 'member');
    `);
    pv = await import("@/lib/planned-visits");
    ({ collectDue } = await import("@/lib/scheduler"));
    ({ runRetention } = await import("@/lib/retention"));
  });

  it("lists planned visits soonest first with who's going", () => {
    pv.savePlan({ orgId: 1, memberId: 3, date: "2026-10-20", time: "19:00", type: "home", note: "", requestId: null, visitors: [1, 2], createdBy: 1 });
    pv.savePlan({ orgId: 1, memberId: 3, date: "2026-10-15", time: null, type: "phone", note: "", requestId: null, visitors: [2], createdBy: 1 });
    const list = pv.upcomingVisits(1);
    expect(list.map((p) => p.date)).toEqual(["2026-10-15", "2026-10-20"]);
    expect(list[1]).toMatchObject({ member_name: "Member Person", time: "19:00", visitors: "Pres Person, Couns Person" });
    expect(pv.visitorIds(list[1]).sort()).toEqual([1, 2]);
    expect(pv.whenText("2026-10-20", "19:00")).toBe("Tue, Oct 20 at 7:00 PM");
    expect(pv.whenText("2026-10-15", null)).toBe("Thu, Oct 15");
  });

  it("reminds the presidency 3 hours before, and the member if they were told", () => {
    const at = (t: string) => DateTime.fromISO(t, { zone: "America/Boise" }).toUTC();
    const rem = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("visit-rem"));
    // 7:00 PM visit: nothing before 4:00 PM, then the reminder; nothing once it's started.
    expect(rem("2026-10-20T15:59").filter((n) => n.key.includes("2026-10-20:19"))).toHaveLength(0);
    let due = rem("2026-10-20T16:00").filter((n) => n.key.includes("2026-10-20:19"));
    expect(due).toHaveLength(1);
    expect(due[0].payload.title).toBe("Visit today: Member Person");
    expect(due[0].payload.body).toContain("7:00 PM");
    // The whole presidency (and anyone going), not the member being visited.
    expect(due[0].recipients.map((r) => r.id).sort()).toEqual([1, 2]);
    expect(rem("2026-10-20T19:00").filter((n) => n.key.includes("2026-10-20:19"))).toHaveLength(0);
    // Once they're told the date and time, the member is reminded too.
    d.exec("UPDATE planned_visits SET member_told = 1 WHERE date = '2026-10-20'");
    due = rem("2026-10-20T17:00").filter((n) => n.key.includes("2026-10-20:19"));
    expect(due.map((n) => n.recipients.map((r) => r.id))).toEqual([[1, 2], [3]]);
    expect(due[1].payload.body).toBe("Pres Person, Couns Person plan to visit you Tue, Oct 20 at 7:00 PM.");
  });

  it("reminds about an early visit the evening before, and one with no time that morning", () => {
    const at = (t: string) => DateTime.fromISO(t, { zone: "America/Boise" }).toUTC();
    pv.savePlan({ orgId: 1, memberId: 3, date: "2026-10-22", time: "09:00", type: "home", note: "", requestId: null, visitors: [1], createdBy: 1 });
    const early = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("visit-rem:") && n.key.includes("2026-10-22"));
    expect(early("2026-10-21T19:59")).toHaveLength(0);
    expect(early("2026-10-21T20:00")[0].payload.title).toBe("Visit tomorrow: Member Person");
    const noTime = collectDue(at("2026-10-15T08:00")).filter((n) => n.key.startsWith("visit-rem:") && n.key.includes("2026-10-15"));
    expect(noTime[0].payload.title).toBe("Visit today: Member Person");
  });

  it("clears planned visits never recorded 30 days after their date", () => {
    d.exec("INSERT INTO planned_visits (org_id, member_id, date) VALUES (1, 3, date('now', '-40 days')), (1, 3, date('now', '-5 days'))");
    const before = (d.prepare("SELECT COUNT(*) AS n FROM planned_visits").get() as { n: number }).n;
    runRetention();
    expect((d.prepare("SELECT COUNT(*) AS n FROM planned_visits").get() as { n: number }).n).toBe(before - 1);
  });
});
