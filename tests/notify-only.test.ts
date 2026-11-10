import { describe, expect, it } from "vitest";

describe("getting an organization's notifications without belonging to it (a parent and Young Women)", () => {
  it("gets its notices and messages, but isn't on its member list or counted as in it", async () => {
    const d = (await import("@/lib/db")).useTestDb();
    const orgs = await import("@/lib/orgs");
    d.exec(`INSERT INTO members (id, name, display_name, email, status) VALUES (1, 'P', 'YW President', 'p@t.l', 'active'), (2, 'G', 'Girl', 'g@t.l', 'active'), (3, 'M', 'Mom', 'm@t.l', 'active')`);
    const w = orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
    const yw = orgs.createOrg(w.id, "Young Women").id;
    for (const id of [2, 3]) orgs.addToWard(id, w.id);
    d.prepare("INSERT OR REPLACE INTO org_members (org_id, member_id, role, official, notify) VALUES (?, 1, 'presidency', 1, 1), (?, 2, 'member', 1, 1), (?, 3, 'member', 0, 1)").run(yw, yw, yw);
    const { audienceMembers } = await import("@/lib/notify");
    const { orgMemberList } = await import("@/lib/member-list");
    expect(audienceMembers(yw, "everyone").map((r) => r.id).sort()).toEqual([1, 2, 3]); // Mom gets its notices
    expect(orgMemberList(yw).map((m) => m.display_name)).toEqual(["YW President", "Girl"]); // but isn't on its list
    expect(orgMemberList(orgs.wardOrg(w.id).id, { show: "noorg" }).map((m) => m.display_name)).toContain("Mom"); // nor counted as in it
  });
});
