import { beforeEach, describe, expect, it } from "vitest";

// Before: one quorum with temple and mission plans (two versions of the temple plan).
const LEGACY = `
  INSERT INTO wards (id, name) VALUES (1, 'Villas Ward Elders Quorum');
  INSERT INTO members (id, ward_id, name, display_name, email, role, is_site_owner) VALUES
    (1, 1, 'B', 'Bishop', 'b@x', 'presidency', 1), (2, 1, 'Y', 'YW Pres', 'y@x', 'member', 0), (3, 1, 'M', 'Member', 'm@x', 'member', 0);
  INSERT INTO plans (ward_id, kind, title, body, created_by) VALUES
    (1, 'temple', 'Temple & Family History Plan', 'v1', 1), (1, 'temple', 'Temple & Family History Plan', 'v2', 1), (1, 'mission', 'Ward Mission Plan', 'm1', 1);
`;

type Db = import("better-sqlite3").Database;
let d: Db;
let plans: typeof import("@/lib/plans");
let orgs: typeof import("@/lib/orgs");

beforeEach(async () => {
  d = (await import("@/lib/db")).useTestDb(LEGACY);
  plans = await import("@/lib/plans");
  orgs = await import("@/lib/orgs");
});

const user = (id: number, orgId?: number) => orgs.currentUserFor(d.prepare("SELECT * FROM members WHERE id = ?").get(id) as never, orgId)!;

describe("ward plans", () => {
  it("turns the quorum's plans into ward plans, keeping every version", () => {
    const list = plans.listPlans(1);
    expect(list.map((p) => [p.name, p.org_ids])).toEqual([
      ["Temple & Family History Plan", []],
      ["Ward Mission Plan", []],
    ]);
    expect(plans.currentVersion(list[0].id)!.body).toBe("v2");
    expect(plans.planHistory(list[0].id).map((v) => v.body)).toEqual(["v2", "v1"]);
    expect(plans.planByLegacyKind(1, "mission")!.id).toBe(list[1].id);
    // The ward level no longer hides plans.
    expect(orgs.wardOrg(1).hidden_features).toBe("lessons");
  });

  it("shows whole-ward plans everywhere and organization plans only where they belong", () => {
    const yw = orgs.createOrg(1, "Young Women");
    const ym = orgs.createOrg(1, "Young Men");
    const rs = orgs.createOrg(1, "Relief Society");
    const youth = plans.createPlan(1, "Youth Temple Plan", [yw.id, ym.id], 1);
    const names = (org: { id: number; kind: string }) => plans.listPlans(1, org).map((p) => p.name);
    expect(names(yw)).toEqual(["Temple & Family History Plan", "Ward Mission Plan", "Youth Temple Plan"]);
    expect(names(rs)).toEqual(["Temple & Family History Plan", "Ward Mission Plan"]);
    expect(names(orgs.wardOrg(1))).toHaveLength(3);
    expect(plans.audienceText(plans.getPlan(1, youth)!, [{ id: yw.id, label: "Young Women" }, { id: ym.id, label: "Young Men" }])).toBe("Young Women and Young Men");
  });

  it("lets the bishopric manage every plan, and organization leaders only theirs", () => {
    const yw = orgs.createOrg(1, "Young Women");
    const ym = orgs.createOrg(1, "Young Men");
    orgs.addToOrg(2, yw.id, { role: "presidency", calling: "president" });
    const ward = plans.listPlans(1)[0];
    const youth = plans.getPlan(1, plans.createPlan(1, "Youth Temple Plan", [yw.id, ym.id], 1))!;
    const ymOnly = plans.getPlan(1, plans.createPlan(1, "Young Men Plan", [ym.id], 1))!;

    const bishop = user(1);
    expect(plans.managesWardPlans(bishop)).toBe(true);
    expect(plans.canEditPlan(bishop, ward)).toBe(true);
    expect(plans.allowedAudience(bishop, [])).toEqual([]);

    const ywPres = user(2, yw.id);
    expect(plans.canCreatePlans(ywPres)).toBe(true);
    expect(plans.canEditPlan(ywPres, ward)).toBe(false);
    expect(plans.canEditPlan(ywPres, youth)).toBe(true);
    expect(plans.canEditPlan(ywPres, ymOnly)).toBe(false);
    // They can only aim plans at organizations they lead.
    expect(plans.allowedAudience(ywPres, [yw.id, ym.id])).toEqual([yw.id]);
    expect(plans.allowedAudience(ywPres, [ym.id])).toBeNull();

    expect(plans.canCreatePlans(user(3))).toBe(false);
  });

  it("starts a new ward with the two standard plans", () => {
    const maple = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 3 });
    expect(plans.listPlans(maple.id).map((p) => p.legacy_kind)).toEqual(["temple", "mission"]);
  });
});

describe("plan pages", () => {
  it("keeps only well-formed blocks, and files uploaded to the plan's own ward", async () => {
    const { parseBlocks, versionBlocks, blocksText } = await import("@/lib/plan-blocks");
    d.prepare("INSERT INTO plan_files (name, ward_id, original_name) VALUES ('aaaaaaaaaaaaaaaaaaaaaaaa.jpg', 1, 'temple.jpg')").run();
    const other = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 3 });
    d.prepare("INSERT INTO plan_files (name, ward_id, original_name) VALUES ('bbbbbbbbbbbbbbbbbbbbbbbb.pdf', ?, 'theirs.pdf')").run(other.id);
    const sent = JSON.stringify([
      { id: "h", type: "heading", text: "Goals" },
      { id: "p", type: "image", file: "aaaaaaaaaaaaaaaaaaaaaaaa.jpg", name: "temple.jpg", width: 400, align: "sideways", caption: "Our temple" },
      { id: "x", type: "pdf", file: "bbbbbbbbbbbbbbbbbbbbbbbb.pdf", name: "theirs.pdf", width: 50, align: "left" },
      { id: "s", type: "script", text: "<script>" },
      { id: "t", type: "text", text: "**Every family** submits a name." },
    ]);
    const blocks = parseBlocks(sent, plans.wardFileCheck(1));
    expect(blocks.map((b) => b.type)).toEqual(["heading", "image", "text"]);
    expect(blocks[1]).toMatchObject({ width: 100, align: "center", caption: "Our temple" });
    expect(parseBlocks("not json", () => true)).toEqual([]);

    const plan = plans.listPlans(1)[0];
    plans.saveVersion({ planId: plan.id, orgId: 1, title: "Temple plan", blocks, createdBy: 1 });
    const v = plans.currentVersion(plan.id)!;
    expect(versionBlocks(v)).toEqual(blocks);
    expect(v.body).toBe(blocksText(blocks));
    // Versions from before the page builder: their attachment, then their text.
    expect(versionBlocks({ blocks: null, body: "Old text", pdf_file: "cccccccccccccccccccccccc.pdf", pdf_name: "old.pdf" }).map((b) => b.type)).toEqual(["pdf", "text"]);
  });
});
