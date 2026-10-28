import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-lock-"));

describe("who leaders may change the sign-in contact of", () => {
  let acc: typeof import("@/lib/accounts");
  let w1: number;
  let w2: number;
  beforeEach(async () => {
    const d = (await import("@/lib/db")).useTestDb();
    const orgs = await import("@/lib/orgs");
    acc = await import("@/lib/accounts");
    d.exec(`INSERT INTO members (id, name, display_name, email, status, contact_pref, last_login_at) VALUES
      (1, 'A', 'Attacker', 'a@test.local', 'active', 'email', datetime('now')),
      (2, 'V', 'Victim', 'v@test.local', 'active', 'email', datetime('now')),
      (3, 'N', 'New Person', 'n@test.local', 'active', 'email', NULL),
      (4, 'L', 'New Leader', 'l@test.local', 'active', 'email', NULL)`);
    w1 = orgs.createWard({ name: "Home Ward", timezone: "America/Boise", creatorId: 2 }).id;
    // Someone starts their own ward and adds the victim by email.
    w2 = orgs.createWard({ name: "Attacker Ward", timezone: "America/Boise", creatorId: 1 }).id;
    const eq = orgs.createOrg(w2, "Elders Quorum").id;
    orgs.addToOrg(2, eq);
    orgs.addToOrg(3, eq);
    orgs.addToOrg(4, eq, { role: "presidency" });
  });

  it("never someone who signs in, belongs to another ward, or leads anything", () => {
    expect(acc.leaderCanEditContact(2, w2)).toBe(false);
    expect(acc.onlyInWard(2, w2)).toBe(false);
    expect(acc.leaderCanEditContact(4, w2)).toBe(false);
    // Someone a leader added who hasn't signed in yet (e.g. to fix a typo).
    expect(acc.leaderCanEditContact(3, w2)).toBe(true);
    expect(acc.onlyInWard(3, w2)).toBe(true);
    expect(acc.leaderCanEditContact(3, w1)).toBe(false);
  });

  it("never a ward administrator or the backup person for messages", async () => {
    const { db } = await import("@/lib/db");
    db().prepare("INSERT INTO ward_admins (ward_id, member_id) VALUES (?, 3)").run(w2);
    expect(acc.leaderCanEditContact(3, w2)).toBe(false);
    db().prepare("DELETE FROM ward_admins").run();
    db().prepare("UPDATE wards SET reply_backup_id = 3 WHERE id = ?").run(w2);
    expect(acc.leaderCanEditContact(3, w2)).toBe(false);
  });

  it("gives whoever started a ward its leadership only until it has a bishopric", async () => {
    const { db } = await import("@/lib/db");
    const { userForSession, createSession } = await import("@/lib/auth-core");
    const as = (id: number) => userForSession(createSession(id, "session").id)!;
    expect(as(1).wardLeader).toBe(true);
    // Member 4 is given presidency access to the ward itself; the starter was released.
    const wardOrg = db().prepare("SELECT id FROM orgs WHERE ward_id = ? AND kind = 'ward'").get(w2) as { id: number };
    db().prepare("UPDATE org_members SET role = 'member' WHERE member_id = 1 AND org_id = ?").run(wardOrg.id);
    db().prepare("INSERT INTO org_members (org_id, member_id, role) VALUES (?, 4, 'presidency') ON CONFLICT DO UPDATE SET role = 'presidency'").run(wardOrg.id);
    expect(as(1).wardLeader).toBe(false);
    expect(as(1).wardAdmin).toBe(false);
  });

  it("keeps the site owner's email for the site owner", () => {
    process.env.OWNER_EMAIL = "Owner@Test.local";
    expect(acc.isOwnerEmail("owner@test.local")).toBe(true);
    expect(acc.isOwnerEmail("someone@test.local")).toBe(false);
    delete process.env.OWNER_EMAIL;
  });
});
