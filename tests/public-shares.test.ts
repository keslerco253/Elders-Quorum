import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-pshare-"));

describe("sharing a whole plan page publicly", () => {
  it("shows only the pictures and PDFs on the plan's current version, and stops when unshared", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'B', 'Bishop', 'b@test.local', 'presidency');
    `);
    const plan = Number(d.prepare("INSERT INTO ward_plans (ward_id, name) VALUES (1, 'Temple Plan')").run().lastInsertRowid);
    const blocks = JSON.stringify([
      { id: "a", type: "image", file: "aaaaaaaaaaaaaaaaaaaaaaaa.png", name: "One", width: 100, align: "center", caption: "" },
      { id: "b", type: "pdf", file: "bbbbbbbbbbbbbbbbbbbbbbbb.pdf", name: "Two", width: 100, align: "center", caption: "", pages: true },
    ]);
    d.prepare("INSERT INTO plan_files (name, ward_id, original_name) VALUES ('aaaaaaaaaaaaaaaaaaaaaaaa.png', 1, 'One'), ('bbbbbbbbbbbbbbbbbbbbbbbb.pdf', 1, 'Two')").run();
    d.prepare("INSERT INTO plan_versions (plan_id, title, body, blocks, created_by) VALUES (?, 'Temple Plan', '', ?, 1)").run(plan, blocks);
    const ps = await import("@/lib/public-shares");
    const token = ps.createShare({ orgId: 1, kind: "plan", planId: plan, title: "", caption: "", createdBy: 1 });
    expect(ps.getShare(token)?.kind).toBe("plan");
    expect(ps.sharedPlanFiles(plan).sort()).toEqual(["aaaaaaaaaaaaaaaaaaaaaaaa.png", "bbbbbbbbbbbbbbbbbbbbbbbb.pdf"]);
    expect(ps.planShareContent(plan)?.blocks).toHaveLength(2);
    expect(ps.stopShare(1, token)).toBe(true);
    expect(ps.getShare(token)).toBeUndefined();
  });
});
