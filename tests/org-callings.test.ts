import { beforeEach, describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { callingNamesByMember, orgCallings, setTeacherWeeks, stopTeachingIfNone, syncLeaderAccess } from "@/lib/org-callings";
import { removeFromOrg } from "@/lib/accounts";

const role = (id: number) => (db().prepare("SELECT role FROM org_members WHERE org_id = 1 AND member_id = ?").get(id) as { role: string }).role;
const give = (calling: number, member: number) => {
  db().prepare("INSERT INTO member_callings (calling_id, member_id) VALUES (?, ?)").run(calling, member);
  syncLeaderAccess(1, member);
};
const release = (calling: number, member: number) => {
  db().prepare("DELETE FROM member_callings WHERE calling_id = ? AND member_id = ?").run(calling, member);
  syncLeaderAccess(1, member);
};

describe("added callings", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'S', 'Smith', 's@x.com', 'member'), (3, 1, 'J', 'Jones', 'j@x.com', 'member');
      INSERT INTO lessons (ward_id, date, kind) VALUES (1, '2026-11-01', 'talk'), (1, '2026-11-08', 'talk'), (1, '2026-11-15', 'talk');
    `);
    db().prepare("INSERT INTO org_callings (id, org_id, name, leader, teaches) VALUES (1, 1, 'Teacher', 0, 1), (2, 1, 'Activities Committee', 0, 0), (3, 1, 'Activities Chair', 1, 0)").run();
  });

  it("lets someone hold several and lists them", () => {
    give(1, 2);
    give(2, 2);
    expect(callingNamesByMember(1).get(2)).toEqual(["Activities Committee", "Teacher"]);
    expect(orgCallings(1).find((c) => c.id === 1)?.holders.map((h) => h.display_name)).toEqual(["Smith"]);
    expect(role(2)).toBe("member");
  });

  it("gives Leadership access while a leader calling is held, and takes it back", () => {
    give(3, 2);
    expect(role(2)).toBe("presidency");
    release(3, 2);
    expect(role(2)).toBe("member");
  });

  it("doesn't take back access that wasn't given by the calling", () => {
    give(3, 1);
    release(3, 1);
    expect(role(1)).toBe("presidency");
  });

  it("sets a teacher's Sundays, moving a Sunday from someone else", () => {
    give(1, 2);
    give(1, 3);
    setTeacherWeeks(1, 2, [1, 2], "2026-10-21");
    const r = setTeacherWeeks(1, 3, [2], "2026-10-21");
    expect(r.removed).toEqual([{ id: 2, weeks: [2] }]);
    expect(orgCallings(1)[orgCallings(1).findIndex((c) => c.id === 1)].holders.map((h) => [h.display_name, h.weeks])).toEqual([
      ["Jones", [2]],
      ["Smith", [1]],
    ]);
    expect((db().prepare("SELECT teacher_id FROM lessons WHERE date = '2026-11-08'").get() as { teacher_id: number }).teacher_id).toBe(3);
  });

  it("stops someone teaching when they no longer hold a teaching calling", () => {
    give(1, 2);
    setTeacherWeeks(1, 2, [1], "2026-10-21");
    release(1, 2);
    expect(stopTeachingIfNone(1, 2, "2026-10-21")?.removed).toEqual([{ id: 2, weeks: [1] }]);
    expect(db().prepare("SELECT * FROM regular_teachers").all()).toEqual([]);
  });

  it("drops their callings when they leave the organization", () => {
    give(2, 2);
    removeFromOrg(2, 1);
    expect(callingNamesByMember(1).get(2)).toBeUndefined();
  });
});
