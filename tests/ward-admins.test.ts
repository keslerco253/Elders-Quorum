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
