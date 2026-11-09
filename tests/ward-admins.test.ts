import { beforeEach, describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { currentUserFor, setWardAdmins, wardAdmins } from "@/lib/orgs";
import type { Member } from "@/lib/types";

const me = (id: number) => currentUserFor(db().prepare("SELECT * FROM members WHERE id = ?").get(id) as Member);

describe("ward administrators", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'B', 'Bishop', 'b@x.com', 'presidency'), (2, 1, 'C', 'Clerk', 'c@x.com', 'member'), (3, 1, 'E', 'Elder', 'e@x.com', 'member'), (4, 1, 'O', 'Owner', 'o@x.com', 'member');
      UPDATE members SET is_site_owner = 1 WHERE id = 4;
    `);
    // The bishop leads the ward itself.
    const ward = db().prepare("SELECT id FROM orgs WHERE ward_id = 1 AND kind = 'ward'").get() as { id: number };
    db().prepare("INSERT INTO org_members (org_id, member_id, role, calling) VALUES (?, 1, 'presidency', 'bishop') ON CONFLICT(org_id, member_id) DO UPDATE SET role = 'presidency'").run(ward.id);
  });

  it("are the bishopric until chosen; then only the (up to two) chosen, plus the site owner", () => {
    expect([1, 2, 3, 4].map((id) => me(id)!.wardAdmin)).toEqual([true, false, false, true]);
    expect(setWardAdmins(1, [2, 3, 1])).toEqual([2, 3]);
    expect(wardAdmins(1).map((a) => a.display_name)).toEqual(["Clerk", "Elder"]);
    expect([1, 2, 3, 4].map((id) => me(id)!.wardAdmin)).toEqual([false, true, true, true]);
  });
});

describe("an organization president who starts the ward", () => {
  it("leads that organization and administers the ward, not the bishopric, and can add the bishop", async () => {
    const { useTestDb, db } = await import("@/lib/db");
    useTestDb();
    db().prepare("INSERT INTO members (id, name, display_name, email, status) VALUES (1, 'M', 'Mark', 'm@x.com', 'active')").run();
    const orgs = await import("@/lib/orgs");
    const w = orgs.createWard({ name: "New Ward", timezone: "America/Boise", creatorId: 1, leads: "Elders Quorum" });
    const eq = (db().prepare("SELECT id FROM orgs WHERE ward_id = ? AND name = 'Elders Quorum'").get(w.id) as { id: number }).id;
    expect(orgs.roleIn(1, eq)).toBe("presidency");
    expect(orgs.roleIn(1, orgs.wardOrg(w.id).id)).toBe("member");
    expect(orgs.wardAdmins(w.id).map((a) => a.id)).toEqual([1]);
    expect(orgs.wardHasBishopric(w.id)).toBe(false);
    const me = orgs.currentUserFor(db().prepare("SELECT * FROM members WHERE id = 1").get() as never, orgs.wardOrg(w.id).id)!;
    expect(me.wardAdmin).toBe(true);
    expect(orgs.setsAccess(me)).toBe(true);
    // Once there's a bishop, leadership access is the bishopric's.
    db().prepare("INSERT INTO members (id, name, display_name, email, status) VALUES (2, 'B', 'Bishop', 'b@x.com', 'active')").run();
    orgs.addToOrg(2, orgs.wardOrg(w.id).id, { role: "presidency", calling: "bishop" });
    expect(orgs.setsAccess(orgs.currentUserFor(db().prepare("SELECT * FROM members WHERE id = 1").get() as never, orgs.wardOrg(w.id).id)!)).toBe(false);
  });
});
