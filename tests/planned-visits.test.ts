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

  it("reminds whoever is going on the morning of the visit, once", () => {
    const morning = DateTime.fromISO("2026-10-20T08:30", { zone: "America/Boise" }).toUTC();
    const due = collectDue(morning).filter((n) => n.key.startsWith("visit-day:"));
    expect(due).toHaveLength(1);
    expect(due[0].payload.title).toBe("Visit today: Member Person");
    expect(due[0].payload.body).toContain("7:00 PM");
    expect(due[0].recipients.map((r) => r.id).sort()).toEqual([1, 2]);
    const night = DateTime.fromISO("2026-10-20T21:00", { zone: "America/Boise" }).toUTC();
    expect(collectDue(night).filter((n) => n.key.startsWith("visit-day:"))).toHaveLength(0);
  });

  it("clears planned visits never recorded 30 days after their date", () => {
    d.exec("INSERT INTO planned_visits (org_id, member_id, date) VALUES (1, 3, date('now', '-40 days')), (1, 3, date('now', '-5 days'))");
    const before = (d.prepare("SELECT COUNT(*) AS n FROM planned_visits").get() as { n: number }).n;
    runRetention();
    expect((d.prepare("SELECT COUNT(*) AS n FROM planned_visits").get() as { n: number }).n).toBe(before - 1);
  });
});
