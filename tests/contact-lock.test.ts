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

  it("keeps the site owner's email for the site owner", () => {
    process.env.OWNER_EMAIL = "Owner@Test.local";
    expect(acc.isOwnerEmail("owner@test.local")).toBe(true);
    expect(acc.isOwnerEmail("someone@test.local")).toBe(false);
    delete process.env.OWNER_EMAIL;
  });
});
