import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-wsvc-"));

describe("ward-level Service", () => {
  it("lists every organization's open service opportunities in the ward, labeled", async () => {
    const d = (await import("@/lib/db")).useTestDb();
    const orgs = await import("@/lib/orgs");
    d.exec("INSERT INTO members (id, name, display_name, email, status, contact_pref) VALUES (1, 'B', 'Bishop', 'b@test.local', 'active', 'email')");
    const w = orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
    const other = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 1 });
    const eq = orgs.createOrg(w.id, "Elders Quorum").id;
    const rs = orgs.createOrg(w.id, "Relief Society").id;
    const maple = orgs.createOrg(other.id, "Primary").id;
    const add = d.prepare("INSERT INTO signups (org_id, title, date, closed) VALUES (?, ?, ?, ?)");
    add.run(eq, "Moving help", "2030-01-10", 0);
    add.run(rs, "Meals", "2030-01-05", 0);
    add.run(rs, "Old", "2030-01-06", 1);
    add.run(maple, "Other ward", "2030-01-07", 0);
    const { listWardSignups } = await import("@/lib/signups");
    expect(listWardSignups(w.id, false, "2029-12-01").map((s) => [s.title, s.org_label])).toEqual([
      ["Meals", "Relief Society"],
      ["Moving help", "Elders Quorum"],
    ]);
  });
});
