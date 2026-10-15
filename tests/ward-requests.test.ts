import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-wreq-"));
process.env.DATA_DIR = dir;

describe("new ward requests", () => {
  let wr: typeof import("@/lib/ward-requests");
  let d: import("better-sqlite3").Database;
  beforeEach(async () => {
    d = (await import("@/lib/db")).useTestDb();
    const orgs = await import("@/lib/orgs");
    wr = await import("@/lib/ward-requests");
    d.exec(`INSERT INTO members (id, name, display_name, email, status, contact_pref, is_site_owner) VALUES (1, 'O', 'Owner', 'owner@test.local', 'active', 'email', 1)`);
    orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
  });

  const ask = () =>
    wr.requestWard({ name: "New Bishop", contact: "newbishop@test.local", contact_kind: "email", ward_name: "Maple Ward", stake: "Meridian Stake", calling: "bishop", timezone: "America/Boise", note: "Call me", member_id: null });

  it("creates nothing until the site owner approves, and tells the owner", async () => {
    const id = await ask();
    expect(d.prepare("SELECT COUNT(*) AS n FROM wards").get()).toEqual({ n: 1 });
    expect(d.prepare("SELECT COUNT(*) AS n FROM members WHERE email = 'newbishop@test.local'").get()).toEqual({ n: 0 });
    expect(wr.pendingWardRequests().map((r) => r.id)).toEqual([id]);
    expect(fs.readdirSync(path.join(dir, "outbox")).some((f) => f.includes("owner@test.local"))).toBe(true);

    const r = await wr.approveWardRequest(id);
    expect(r?.ward_id).toBeTruthy();
    const ward = d.prepare("SELECT name FROM wards WHERE id = ?").get(r!.ward_id) as { name: string };
    expect(ward.name).toBe("Maple Ward");
    const lead = d.prepare("SELECT om.role, om.calling FROM org_members om JOIN orgs o ON o.id = om.org_id WHERE o.ward_id = ? AND o.kind = 'ward' AND om.member_id = ?").get(r!.ward_id, r!.member_id);
    expect(lead).toEqual({ role: "presidency", calling: "bishop" });
    expect(fs.readdirSync(path.join(dir, "outbox")).some((f) => f.includes("newbishop@test.local"))).toBe(true);
    expect(await wr.approveWardRequest(id)).toBeNull();
  });

  it("declines without creating anything", async () => {
    const id = await ask();
    expect((await wr.declineWardRequest(id, "Please talk with your stake first."))?.status).toBe("pending");
    expect(wr.pendingWardRequests()).toEqual([]);
    expect(d.prepare("SELECT COUNT(*) AS n FROM wards").get()).toEqual({ n: 1 });
  });
});
