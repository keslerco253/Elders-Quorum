import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-groups-"));
process.env.DATA_DIR = dir;

type Db = import("better-sqlite3").Database;
let d: Db;
let groups: typeof import("@/lib/groups");
let eq: number;
let gid: number;

beforeEach(async () => {
  d = (await import("@/lib/db")).useTestDb();
  const orgs = await import("@/lib/orgs");
  groups = await import("@/lib/groups");
  d.exec(`INSERT INTO members (id, name, display_name, email, status, contact_pref) VALUES
    (1, 'B', 'Bishop', 'b@test.local', 'active', 'email'), (2, 'P', 'Pres', 'p@test.local', 'active', 'email'),
    (3, 'A', 'Admin', 'a@test.local', 'active', 'email'), (4, 'C', 'Committee Member', 'c@test.local', 'active', 'email'),
    (5, 'D', 'Dee', 'd@test.local', 'active', 'email'), (6, 'O', 'Other', 'o@test.local', 'active', 'email')`);
  const w = orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
  eq = orgs.createOrg(w.id, "Elders Quorum").id;
  orgs.addToOrg(2, eq, { role: "presidency" });
  orgs.addToOrg(3, eq, { role: "admin" });
  for (const id of [4, 5, 6]) orgs.addToOrg(id, eq);
  gid = Number(d.prepare("INSERT INTO groups (org_id, name, send_presidency, send_admins, send_members) VALUES (?, 'Activities committee', 1, 0, 1)").run(eq).lastInsertRowid);
  d.prepare("INSERT INTO group_members (group_id, member_id) VALUES (?, 4), (?, 5)").run(gid, gid);
});

describe("message groups", () => {
  it("lets only the people the group allows see it and send to it", () => {
    const g = groups.getGroup(gid, eq)!;
    expect(groups.canSendTo(g, 2, "presidency")).toBe(true);
    expect(groups.canSendTo(g, 3, "admin")).toBe(false);
    expect(groups.canSendTo(g, 4, "member")).toBe(true);
    expect(groups.canSendTo(g, 6, "member")).toBe(false);
    expect(groups.canManage(g, "presidency")).toBe(true);
    expect(groups.canManage(g, "admin")).toBe(false);
    expect(groups.sendableGroups({ id: 4, org_id: eq, role: "member" }).map((x) => x.name)).toEqual(["Activities committee"]);
    expect(groups.sendableGroups({ id: 6, org_id: eq, role: "member" })).toEqual([]);
    expect(groups.sendersText(g, { kind: "group" })).toBe("The presidency and people in the group");
  });

  it("sends a member's message to the rest of the group, signed with their name", async () => {
    const r = await groups.sendToAudience({ orgId: eq, senderId: 4, audience: `group:${gid}`, title: "Committee Member", body: "Meeting at 7 tonight", tz: "America/Boise", personal: { from: "Committee Member" } });
    expect(r.count).toBe(1);
    expect(d.prepare("SELECT member_id FROM message_recipients WHERE message_id = ?").all(r.messageId)).toEqual([{ member_id: 5 }]);
    expect(groups.memberGroupSendsToday(4)).toBe(1);
    const mail = fs.readdirSync(path.join(dir, "outbox")).find((f) => f.includes("d@test.local"))!;
    const text = fs.readFileSync(path.join(dir, "outbox", mail), "utf8");
    expect(text).toContain("A message from Committee Member");
    expect(text).toContain("Meeting at 7 tonight");
  });
});
