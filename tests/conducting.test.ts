import { beforeEach, describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { answerSwap, askToConduct, cancelSwap, conductingSchedule, swapsWaitingOn } from "@/lib/conducting";

describe("who's conducting", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'F', 'First', 'f@x.com', 'presidency'), (3, 1, 'S', 'Second', 's@x.com', 'presidency');
    `);
    db().prepare("UPDATE org_members SET calling = CASE member_id WHEN 1 THEN 'bishop' WHEN 2 THEN 'first_counselor' ELSE 'second_counselor' END").run();
  });

  it("follows the callings by month", () => {
    // Oct, Nov, Dec, Jan: bishop, first, second, bishop.
    const months = ["2026-10-25", "2026-11-01", "2026-12-06", "2027-01-03"].map((d) => conductingSchedule(1, d, 1)[0]);
    expect(months.map((c) => c.name)).toEqual(["Pres", "First", "Second", "Pres"]);
    expect(months[1].calling).toMatch(/First Counselor/);
  });

  it("hands a Sunday to someone who accepts; only the one conducting can ask", () => {
    expect(askToConduct(1, "2026-11-01", 1, 3, "", "2026-10-21")).toEqual({ error: "Only whoever is conducting that Sunday can ask someone else." });
    const r = askToConduct(1, "2026-11-01", 2, 3, "Out of town", "2026-10-21");
    if (!("id" in r)) throw new Error("no request");
    expect(swapsWaitingOn(3, "2026-10-21").map((s) => s.note)).toEqual(["Out of town"]);
    expect(conductingSchedule(1, "2026-11-01", 1)[0]).toMatchObject({ name: "First", pending: { toName: "Second" } });
    expect(answerSwap(r.id, 1, true)).toBeNull(); // not the one asked
    answerSwap(r.id, 3, true);
    expect(conductingSchedule(1, "2026-11-01", 1)[0]).toMatchObject({ name: "Second", insteadOf: "First", pending: null });
    // Now Second can pass it on; a decline leaves it with them.
    const again = askToConduct(1, "2026-11-01", 3, 1, "", "2026-10-21");
    if (!("id" in again)) throw new Error("no request");
    answerSwap(again.id, 1, false);
    expect(conductingSchedule(1, "2026-11-01", 1)[0].name).toBe("Second");
    const third = askToConduct(1, "2026-11-01", 3, 1, "", "2026-10-21");
    if ("id" in third) expect(cancelSwap(third.id, 3)).toBe(true);
    expect(conductingSchedule(1, "2026-11-01", 1)[0].pending).toBeNull();
  });
});
