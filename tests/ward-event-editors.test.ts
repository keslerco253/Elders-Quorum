import { describe, expect, it } from "vitest";

describe("who can edit an event", () => {
  it("whole-ward events: any presidency in the ward (and ward admins); an organization's own: just its presidency", async () => {
    const d = (await import("@/lib/db")).useTestDb();
    const orgs = await import("@/lib/orgs");
    d.exec(`INSERT INTO members (id, name, display_name, email, status) VALUES
      (1, 'B', 'Bishop', 'b@t.l', 'active'), (2, 'E', 'EQ President', 'e@t.l', 'active'),
      (3, 'M', 'Member', 'm@t.l', 'active'), (4, 'O', 'Other ward EQ', 'o@t.l', 'active')`);
    const w = orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
    const other = orgs.createWard({ name: "Rimrock Ward", timezone: "America/Boise", creatorId: 4 });
    const ward = orgs.wardOrg(w.id).id;
    const eq = orgs.createOrg(w.id, "Elders Quorum").id;
    const rs = orgs.createOrg(w.id, "Relief Society").id;
    const otherEq = orgs.createOrg(other.id, "Elders Quorum").id;
    for (const id of [2, 3]) orgs.addToWard(id, w.id);
    d.prepare("INSERT OR REPLACE INTO org_members (org_id, member_id, role) VALUES (?, 1, 'presidency'), (?, 2, 'presidency'), (?, 3, 'member'), (?, 4, 'presidency')").run(ward, eq, eq, otherEq);

    expect(orgs.editsEventsOf(1, ward)).toBe(true); // the bishopric
    expect(orgs.editsEventsOf(2, ward)).toBe(true); // Elders Quorum president, not in the bishopric
    expect(orgs.editsEventsOf(3, ward)).toBe(false); // a member
    expect(orgs.editsEventsOf(4, ward)).toBe(false); // a presidency in another ward
    expect(orgs.editsEventsOf(3, ward, w.id)).toBe(true); // a ward administrator
    expect(orgs.editsEventsOf(2, eq)).toBe(true);
    expect(orgs.editsEventsOf(2, rs)).toBe(false); // another organization's own event
    expect(orgs.editsEventsOf(3, rs, w.id)).toBe(false);
  });
});
