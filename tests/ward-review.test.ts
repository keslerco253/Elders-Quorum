import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-wrev-"));
process.env.DATA_DIR = dir;

describe("new wards under review", () => {
  let d: import("better-sqlite3").Database;
  let orgs: typeof import("@/lib/orgs");
  let rev: typeof import("@/lib/ward-review");
  const outbox = () => (fs.existsSync(path.join(dir, "outbox")) ? fs.readdirSync(path.join(dir, "outbox")) : []);
  beforeEach(async () => {
    d = (await import("@/lib/db")).useTestDb();
    orgs = await import("@/lib/orgs");
    rev = await import("@/lib/ward-review");
    d.exec(`INSERT INTO members (id, name, display_name, email, status, contact_pref, is_site_owner) VALUES
      (1, 'O', 'Owner', 'owner@test.local', 'active', 'email', 1),
      (2, 'T', 'Tom Test', 'tom@test.local', 'active', 'email', 0)`);
    orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
  });

  it("is set up right away, but can't be joined or send anything until approved", async () => {
    const maple = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 2, pending: { stake: "Meridian Stake", note: "Call me" } });
    await rev.tellOwnerAboutNewWard(maple.id);
    expect(outbox().some((f) => f.includes("owner@test.local"))).toBe(true);
    expect(orgs.getWard(maple.id)).toMatchObject({ pending: 1, stake: "Meridian Stake" });
    expect(rev.pendingWards().map((w) => w.name)).toEqual(["Maple Ward"]);
    const { wardByJoinCode } = await import("@/lib/wards");
    expect(wardByJoinCode(maple.join_code!)).toBeUndefined();

    // Nothing is sent from it while it's under review.
    const { notify, recipientById } = await import("@/lib/notify");
    const mapleOrg = orgs.wardOrg(maple.id).id;
    expect((await notify([recipientById(2, mapleOrg)!], { title: "Hi", body: "Test", url: "/" })).reached).toBe(0);

    const before = outbox().filter((f) => f.includes("tom@test.local")).length;
    expect((await rev.approveWard(maple.id))?.name).toBe("Maple Ward");
    expect(orgs.getWard(maple.id)?.pending).toBe(0);
    expect(wardByJoinCode(maple.join_code!)?.id).toBe(maple.id);
    expect(outbox().filter((f) => f.includes("tom@test.local")).length).toBe(before + 1);
    expect(await rev.approveWard(maple.id)).toBeNull();
  });

  it("declining deletes the ward", async () => {
    const maple = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 2, pending: { stake: "", note: "" } });
    expect((await rev.declineWard(maple.id, "Talk with your stake first."))?.name).toBe("Maple Ward");
    expect(orgs.getWard(maple.id)).toBeUndefined();
  });
});
