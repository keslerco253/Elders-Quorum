import { describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { savePlan } from "@/lib/planned-visits";
import { myAssignments, soonAssignments } from "@/lib/assignments";

describe("planned visits on the visitors' lists", () => {
  it("shows an upcoming visit in My assignments and Coming up for each visitor", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Mark', 'p@x.com', 'presidency'), (2, 1, 'T', 'Tyson', 't@x.com', 'member'), (3, 1, 'J', 'Jeff Olsen', 'j@x.com', 'member');
    `);
    savePlan({ orgId: 1, memberId: 3, date: "2026-11-09", time: "19:00", type: "home", note: "", requestId: null, visitors: [1, 2], createdBy: 1 });
    for (const who of [1, 2]) {
      const v = myAssignments(who, "2026-11-08").find((i) => i.kind === "visit")!;
      expect(v).toMatchObject({ title: "Visit Jeff Olsen", date: "2026-11-09", time: "19:00" });
      expect(v.detail).toContain("In their home");
      expect(soonAssignments(who, "2026-11-08").some((i) => i.kind === "visit")).toBe(true);
    }
    expect(myAssignments(1, "2026-11-08").find((i) => i.kind === "visit")!.href).toContain("/admin/visits");
    // Not for the member being visited, and gone once its day has passed.
    expect(myAssignments(3, "2026-11-08").some((i) => i.kind === "visit")).toBe(false);
    expect(myAssignments(1, "2026-11-10").some((i) => i.kind === "visit")).toBe(false);
    void db;
  });
});
