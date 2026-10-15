import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-orgs-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

// The app as it was: one elders quorum ("ward" 1) with a president (site owner),
// an admin and two members, a lesson and a leaders-only event.
const LEGACY = `
  INSERT INTO wards (id, name, timezone, join_code, sms_monthly_limit) VALUES (1, 'Villas Ward Elders Quorum', 'America/Boise', 'VILLAS', 3);
  INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref, role, calling, is_site_owner, sms_consent_at) VALUES
    (1, 1, 'P', 'Pres', 'p@test.local', NULL, 'email', 'presidency', 'president', 1, NULL),
    (2, 1, 'A', 'Admin', 'a@test.local', NULL, 'email', 'admin', NULL, 0, NULL),
    (3, 1, 'M', 'Member', 'm@test.local', '+12085550103', 'text', 'member', NULL, 0, datetime('now')),
    (4, 1, 'R', 'Sister Rae', 'r@test.local', NULL, 'email', 'member', NULL, 0, NULL);
  INSERT INTO lessons (ward_id, date, kind, title) VALUES (1, '2030-01-06', 'talk', 'Faith');
  INSERT INTO events (ward_id, title, starts_at, ends_at, presidency_only) VALUES
    (1, 'EQ activity', '2030-01-10T02:00:00Z', '2030-01-10T03:00:00Z', 0),
    (1, 'EQ presidency meeting', '2030-01-11T02:00:00Z', '2030-01-11T03:00:00Z', 1);
`;

type Db = import("better-sqlite3").Database;
let d: Db;
let orgs: typeof import("@/lib/orgs");

beforeEach(async () => {
  d = (await import("@/lib/db")).useTestDb(LEGACY);
  orgs = await import("@/lib/orgs");
});

const member = (id: number) => d.prepare("SELECT * FROM members WHERE id = ?").get(id) as import("@/lib/types").Member;

describe("moving to wards and organizations", () => {
  it("turns the quorum into Elders Quorum inside Villas Ward, keeping everything", () => {
    expect(orgs.getWard(1)).toMatchObject({ name: "Villas Ward", join_code: "VILLAS", sms_monthly_limit: 3 });
    const list = orgs.orgsInWard(1);
    expect(list.map((o) => [o.kind, orgs.orgLabel(o)])).toEqual([
      ["ward", "Villas Ward"],
      ["group", "Elders Quorum"],
    ]);
    // Same id, so lessons and events didn't move.
    expect(list[1].id).toBe(1);
    expect(d.prepare("SELECT org_id FROM lessons").get()).toEqual({ org_id: 1 });
    expect(orgs.roleIn(1, 1)).toBe("presidency");
    expect(orgs.roleIn(2, 1)).toBe("admin");
    expect(orgs.roleIn(3, 1)).toBe("member");
    // The site owner leads the ward-wide organization until the bishopric is added.
    expect(orgs.roleIn(1, list[0].id)).toBe("presidency");
    expect(orgs.roleIn(3, list[0].id)).toBe("member");
  });

  it("shows each person their organizations, with their role in the one they're looking at", () => {
    const pres = orgs.currentUserFor(member(1))!;
    expect(pres).toMatchObject({ org_id: 1, orgLabel: "Elders Quorum", role: "presidency", calling: "president", wardLeader: true });
    const wardView = orgs.currentUserFor(member(3), orgs.wardOrg(1).id)!;
    expect(wardView).toMatchObject({ orgLabel: "Villas Ward", role: "member", wardLeader: false });
    expect(wardView.orgs.map((o) => [o.label, o.joined])).toEqual([
      ["Villas Ward", true],
      ["Elders Quorum", true],
    ]);
  });
});

describe("organizations in a ward", () => {
  it("lets the bishopric add one with a president; members see it and choose it", () => {
    const rs = orgs.createOrg(1, "Relief Society", ["visits"]);
    orgs.addToOrg(4, rs.id, { role: "presidency", calling: "president" });
    expect(orgs.hasFeature(rs, "visits")).toBe(false);
    expect(orgs.hasFeature(rs, "lessons")).toBe(true);
    // Everyone in the ward can look at it; their role there is "member" unless they lead it.
    expect(orgs.currentUserFor(member(3), rs.id)).toMatchObject({ org_id: rs.id, role: "member" });
    expect(orgs.currentUserFor(member(4), rs.id)).toMatchObject({ role: "presidency", calling: "president" });
    expect(orgs.orgRoster(rs.id).map((p) => p.id)).toEqual([4]);
  });

  it("can't be looked at from outside the ward", () => {
    const other = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 2 });
    const maple = orgs.createOrg(other.id, "Elders Quorum");
    // Member 3 isn't in Maple Ward: they stay in their own.
    expect(orgs.currentUserFor(member(3), maple.id)!.ward_id).toBe(1);
    // Member 2 created it, so leads it, and can switch between both wards.
    const admin = orgs.currentUserFor(member(2), maple.id)!;
    expect(admin).toMatchObject({ ward_id: other.id, wardLeader: true });
    expect(admin.wards.map((w) => w.name)).toEqual(["Maple Ward", "Villas Ward"]);
    expect(other.join_code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("deletes an organization and everything in it, but never the ward itself", () => {
    expect(orgs.deleteOrg(orgs.wardOrg(1).id)).toBe(false);
    expect(orgs.deleteOrg(1)).toBe(true);
    expect(d.prepare("SELECT COUNT(*) AS n FROM lessons").get()).toEqual({ n: 0 });
    expect(d.prepare("SELECT COUNT(*) AS n FROM members").get()).toEqual({ n: 4 });
    expect(orgs.inWard(3, 1)).toBe(true);
  });
});

describe("notifications per organization", () => {
  it("go to whoever gets that organization's notifications, and leaders always", async () => {
    const { audienceMembers } = await import("@/lib/notify");
    const rs = orgs.createOrg(1, "Relief Society");
    orgs.addToOrg(4, rs.id, { role: "presidency" });
    // Member 3 follows Relief Society without belonging; member 1 stops EQ notifications but leads it.
    orgs.addToOrg(3, rs.id, { official: false, notify: true });
    d.prepare("UPDATE org_members SET notify = 0 WHERE org_id = 1 AND member_id IN (1, 2)").run();
    const ids = (orgId: number, a: Parameters<typeof audienceMembers>[1] = "everyone") => audienceMembers(orgId, a).map((r) => r.id).sort();
    expect(ids(rs.id)).toEqual([3, 4]);
    expect(ids(1)).toEqual([1, 2, 3, 4]); // admin and president still get them as leaders
    expect(ids(1, "presidency")).toEqual([1]);
    expect(ids(orgs.wardOrg(1).id)).toEqual([1, 2, 3, 4]);
    // Only official members and leaders are on the roster.
    expect(orgs.orgRoster(rs.id).map((p) => p.id)).toEqual([4]);
  });

  it("send texts naming the ward and organization, count them for the whole ward, and route a texted reply back", async () => {
    const { notify, recipientById } = await import("@/lib/notify");
    const { textsThisMonth, canSendNotice } = await import("@/lib/sms");
    const rs = orgs.createOrg(1, "Relief Society");
    await notify([recipientById(3, rs.id)!], { title: "Dinner", body: "Thursday", url: "/" });
    const sms = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("sms-"));
    expect(fs.readFileSync(path.join(dir, "outbox", sms.pop()!), "utf8")).toContain(`Villas Ward Relief Society: Dinner. Thursday ${process.env.APP_URL ?? "http://localhost:3000"}/?n=`);
    await notify([recipientById(3, 1)!], { title: "Lesson", body: "Sunday", url: "/lessons" });
    expect(textsThisMonth(1, "notice")).toBe(2);
    // The ward's limit (3) covers all its organizations.
    await notify([recipientById(3, rs.id)!], { title: "Again", body: "x", url: "/" });
    expect(canSendNotice(rs.id)).toBe(false);
    expect(canSendNotice(1)).toBe(false);

    // A reply goes to the organization that texted last (Relief Society).
    const { handleInboundText } = await import("@/lib/sms-inbound");
    expect(await handleInboundText({ From: "+12085550103", Body: "I'll bring rolls" })).toBe("saved");
    expect(d.prepare("SELECT org_id, body FROM member_messages").all()).toEqual([{ org_id: rs.id, body: "I'll bring rolls" }]);
  });

  it("open the app in the organization they're about", async () => {
    const { notify, recipientById } = await import("@/lib/notify");
    const rs = orgs.createOrg(1, "Relief Society");
    d.prepare("UPDATE members SET contact_pref = 'email' WHERE id = 3").run();
    await notify([recipientById(3, rs.id)!], { title: "Hi", body: "x", url: "/signups" });
    const mail = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("m@test.local")).pop()!;
    expect(fs.readFileSync(path.join(dir, "outbox", mail), "utf8")).toMatch(new RegExp(`/signups\\?n=\\d+&org=${rs.id}`));
  });
});

describe("private conversations", () => {
  it("stay inside their organization", async () => {
    const conv = await import("@/lib/conversations");
    const rs = orgs.createOrg(1, "Relief Society");
    orgs.addToOrg(4, rs.id, { role: "presidency" });
    await conv.receiveReply({ id: 3, org_id: rs.id, display_name: "Member" }, "Just for Relief Society", "app", null);
    await conv.receiveReply({ id: 3, org_id: 1, display_name: "Member" }, "Just for the quorum", "app", null);
    expect(conv.wardConversations(rs.id, 4).map((c) => c.last_body)).toEqual(["Just for Relief Society"]);
    expect(conv.wardConversations(1, 1).map((c) => c.last_body)).toEqual(["Just for the quorum"]);
    expect(conv.unreadReplies(1, 1)).toBe(1);
    expect(conv.conversation(1, 3, { private: false }).map((c) => c.body)).toEqual(["Just for the quorum"]);
  });
});

describe("the ward calendar", () => {
  it("shows every organization's events, filters to one, and keeps leaders-only events to that organization's leaders", async () => {
    const { eventsBetween } = await import("@/lib/events");
    const rs = orgs.createOrg(1, "Relief Society");
    orgs.addToOrg(4, rs.id, { role: "presidency" });
    d.prepare("INSERT INTO events (org_id, title, starts_at, ends_at, presidency_only) VALUES (?, 'RS dinner', '2030-01-12T02:00:00Z', '2030-01-12T03:00:00Z', 0)").run(rs.id);
    const titles = (viewer: number, where: Parameters<typeof eventsBetween>[3] = { wardId: 1 }) =>
      eventsBetween(viewer, "2030-01-01T00:00:00Z", "2030-02-01T00:00:00Z", where).map((e) => e.title);
    expect(titles(3)).toEqual(["EQ activity", "RS dinner"]);
    expect(titles(1)).toEqual(["EQ activity", "EQ presidency meeting", "RS dinner"]);
    // The Relief Society president doesn't see the quorum's leaders-only meeting.
    expect(titles(4)).toEqual(["EQ activity", "RS dinner"]);
    expect(titles(3, { wardId: 1, orgIds: [rs.id] })).toEqual(["RS dinner"]);
    // A subscription has only the organizations they're in: member 3 isn't in Relief Society.
    expect(titles(3, { joinedOnly: true })).toEqual(["EQ activity"]);
    expect(eventsBetween(3, "2030-01-01T00:00:00Z", "2030-02-01T00:00:00Z", { wardId: 1 })[1].org_label).toBe("Relief Society");
  });
});

describe("leaving", () => {
  it("removes someone from one organization, or from the ward (deleting an account left in no ward)", async () => {
    const accounts = await import("@/lib/accounts");
    expect(accounts.isLastPresidency(1, 1)).toBe(true);
    expect(accounts.onlyLeaderOf(1)).toEqual([1, orgs.wardOrg(1).id]);
    accounts.removeFromOrg(3, 1);
    expect(orgs.inWard(3, 1)).toBe(true);
    expect(accounts.removeFromWard(3, 1)).toBe(true);
    expect(d.prepare("SELECT id FROM members WHERE id = 3").get()).toBeUndefined();
  });
});

describe("starting wards", () => {
  it("leaves texting off for wards others start until the site owner turns it on", async () => {
    const { canSendNotice } = await import("@/lib/sms");
    const maple = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 3 });
    const eq = orgs.createOrg(maple.id, "Elders Quorum");
    expect(maple.texting_enabled).toBe(0);
    expect(canSendNotice(eq.id)).toBe(false);
    expect(canSendNotice(1)).toBe(true);
    d.prepare("UPDATE wards SET texting_enabled = 1 WHERE id = ?").run(maple.id);
    expect(canSendNotice(eq.id)).toBe(true);
    expect(orgs.createWard({ name: "Oak Ward", timezone: "America/Boise", creatorId: 1, texting: true }).texting_enabled).toBe(1);
  });

  it("knows the site owner by the database or by OWNER_EMAIL", () => {
    expect(orgs.isSiteOwner(member(1))).toBe(true);
    expect(orgs.isSiteOwner(member(3))).toBe(false);
    process.env.OWNER_EMAIL = " M@Test.Local ";
    expect(orgs.isSiteOwner(member(3))).toBe(true);
    expect(orgs.currentUserFor(member(3))!.is_site_owner).toBe(1);
    delete process.env.OWNER_EMAIL;
  });

  it("deletes a ward with everything in it, and people who were only there", () => {
    const maple = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 3 });
    orgs.createOrg(maple.id, "Primary");
    d.prepare("INSERT INTO members (id, name, display_name, email) VALUES (9, 'N', 'Newcomer', 'n@test.local')").run();
    orgs.addToWard(9, maple.id);
    expect(orgs.deleteWard(maple.id)).toEqual({ accounts: 1 });
    expect(orgs.getWard(maple.id)).toBeUndefined();
    expect(d.prepare("SELECT COUNT(*) AS n FROM orgs WHERE ward_id = ?").get(maple.id)).toEqual({ n: 0 });
    // Member 3 is still in Villas Ward, so keeps their account.
    expect(member(3)).toBeDefined();
    expect(member(9)).toBeUndefined();
  });
});

describe("the organization you're looking at", () => {
  it("follows the latest switch on any device", async () => {
    const { createSession, userForSession } = await import("@/lib/auth-core");
    const rs = orgs.createOrg(1, "Relief Society");
    const phone = createSession(1, "month").id;
    const computer = createSession(1, "month").id;
    // The phone switches to Relief Society.
    expect(userForSession(phone, { orgId: rs.id, at: 1000 })!.org_id).toBe(rs.id);
    // The computer still has an older choice (Elders Quorum) in its cookie: it follows the phone.
    expect(userForSession(computer, { orgId: 1, at: 500 })!.org_id).toBe(rs.id);
    expect(userForSession(computer)!.org_id).toBe(rs.id);
    // Then the computer switches back; the phone follows.
    expect(userForSession(computer, { orgId: 1, at: 2000 })!.org_id).toBe(1);
    expect(userForSession(phone, { orgId: rs.id, at: 1000 })!.org_id).toBe(1);
    // An organization in a ward they aren't in is ignored.
    const maple = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 2 });
    expect(userForSession(phone, { orgId: orgs.wardOrg(maple.id).id, at: 3000 })!.org_id).toBe(1);
  });
});

describe("leaders setting someone's organizations", () => {
  it("lets the bishopric set any organization and a presidency only its own", () => {
    const rs = orgs.createOrg(1, "Relief Society");
    const ward = orgs.wardOrg(1);
    // Pres (1) leads Elders Quorum and, as site owner, the ward.
    expect(orgs.managedOrgs(orgs.currentUserFor(member(1), ward.id)!).map((o) => o.name)).toEqual(["Elders Quorum", "Relief Society"]);
    // An Elders Quorum president who isn't in the bishopric.
    d.prepare("DELETE FROM org_members WHERE org_id = ? AND member_id = 1").run(ward.id);
    d.prepare("UPDATE wards SET created_by = 2").run();
    expect(orgs.managedOrgs(orgs.currentUserFor(member(1), 1)!).map((o) => o.id)).toEqual([1]);
    // Admins and members can't.
    expect(orgs.managedOrgs(orgs.currentUserFor(member(3), 1)!)).toEqual([]);
    expect(rs.kind).toBe("group");
  });
});
