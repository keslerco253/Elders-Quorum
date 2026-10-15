import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-compose-"));
process.env.DATA_DIR = dir;

let compose: typeof import("@/lib/compose");
let groups: typeof import("@/lib/groups");
let eq: number;
let rs: number;
let gid: number;

beforeEach(async () => {
  const d = (await import("@/lib/db")).useTestDb();
  const orgs = await import("@/lib/orgs");
  compose = await import("@/lib/compose");
  groups = await import("@/lib/groups");
  d.exec(`INSERT INTO members (id, name, display_name, email, status, contact_pref) VALUES
    (1, 'B', 'Bishop', 'b@test.local', 'active', 'email'), (2, 'P', 'Pres', 'p@test.local', 'active', 'email'),
    (3, 'C', 'Cal', 'c@test.local', 'active', 'email'), (4, 'D', 'Dee', 'd@test.local', 'active', 'email')`);
  const w = orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
  eq = orgs.createOrg(w.id, "Elders Quorum").id;
  rs = orgs.createOrg(w.id, "Relief Society").id;
  orgs.addToOrg(2, eq, { role: "presidency" });
  orgs.addToOrg(3, eq);
  orgs.addToOrg(4, rs);
  gid = Number(d.prepare("INSERT INTO groups (org_id, name, send_presidency, send_admins, send_members) VALUES (?, 'Ministering', 1, 0, 0)").run(eq).lastInsertRowid);
  d.prepare("INSERT INTO group_members (group_id, member_id) VALUES (?, 3)").run(gid);
});

describe("new message choices", () => {
  it("offers a leader every audience and person in the organizations they lead, and nothing elsewhere", () => {
    const { orgs, people } = compose.composeChoices(2);
    expect(orgs.map((o) => o.orgId)).toEqual([eq]);
    const values = orgs[0].audiences.map((a) => a.value);
    expect(values).toContain(`aud:${eq}:everyone`);
    expect(values).toContain(`aud:${eq}:presidency`);
    expect(values).toContain(`aud:${eq}:group:${gid}`);
    expect(people.map((p) => p.value)).toEqual([`person:${eq}:3`]);
    expect(compose.composeChoices(3)).toEqual({ orgs: [], people: [] });
  });

  it("lists announcements a leader can see in Sent", async () => {
    await groups.sendToAudience({ orgId: eq, senderId: 2, audience: `group:${gid}`, title: "Hello", body: "Ministering reports due", tz: "America/Boise" });
    const sent = compose.sentAnnouncements(2);
    expect(sent.map((s) => s.title)).toEqual(["Hello"]);
    expect(compose.sentAnnouncements(3)).toEqual([]);
  });
});

describe("member inbox", () => {
  it("shows conversations and announcements newest first, with unread state", async () => {
    const conv = await import("@/lib/conversations");
    const mi = await import("@/lib/member-inbox");
    await groups.sendToAudience({ orgId: eq, senderId: 2, audience: "everyone", title: "Service Saturday", body: "Meet at 9", tz: "America/Boise" });
    await conv.sendAnswer({ id: 2, org_id: eq, display_name: "Pres" }, 3, "Thanks for helping", true);
    const rows = mi.memberInbox(3);
    expect(rows.map((r) => r.kind)).toEqual(["thread", "announcement"]);
    expect(rows[0]).toMatchObject({ with_id: 2, with_name: "Pres", unread: 1 });
    expect(mi.unreadAnnouncements(3)).toBe(1);
    // The sender's own announcement isn't in their inbox.
    expect(mi.memberInbox(2).some((r) => r.kind === "announcement")).toBe(false);
    const a = rows[1] as import("@/lib/member-inbox").AnnouncementRow;
    expect(mi.openAnnouncement(3, a.id)?.title).toBe("Service Saturday");
    expect(mi.unreadAnnouncements(3)).toBe(0);
    expect(mi.openAnnouncement(4, a.id)).toBeUndefined();
    expect(mi.openMemberThread(3, eq, 2).map((c) => c.body)).toEqual(["Thanks for helping"]);
    expect(conv.unreadAnswers(3)).toBe(0);
  });

  it("lists what a member sent, and who they can write to", async () => {
    const conv = await import("@/lib/conversations");
    const mi = await import("@/lib/member-inbox");
    await conv.receiveReply({ id: 3, org_id: eq, display_name: "Cal" }, "Can I help with moves?", "app", null);
    expect(mi.memberSent(3).map((r) => [r.to, r.body])).toEqual([["the presidency", "Can I help with moves?"]]);
    const choices = compose.memberComposeChoices(3).find((o) => o.orgId === eq)!;
    expect(choices.choices.map((c) => c.value)).toEqual([`p:${eq}:0`, `p:${eq}:2`]);
  });
});

