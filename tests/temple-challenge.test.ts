import { expect, it } from "vitest";
import { useTestDb } from "@/lib/db";
it("posts the challenge to the ward with code YQE4W8, once", async () => {
  const d = useTestDb(`INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise'), (2, 'Other Ward', 'America/Boise');`);
  // Migrations already ran (no code yet): nothing posted. Set the code and run 104's SQL again.
  d.prepare("UPDATE wards SET join_code = 'YQE4W8' WHERE id = 1").run();
  const { migrations } = await import("@/lib/db/migrations");
  const sql = migrations.find((m) => m.id === 104)!.sql;
  d.exec(sql);
  d.exec(sql);
  const plans = d.prepare("SELECT ward_id, name FROM ward_plans WHERE name LIKE 'Bring Heaven%'").all();
  expect(plans).toEqual([{ ward_id: 1, name: "Bring Heaven Closer: Temple & Family History Challenge" }]);
  expect((d.prepare("SELECT COUNT(*) AS n FROM plan_versions v JOIN ward_plans p ON p.id = v.plan_id WHERE p.name LIKE 'Bring Heaven%'").get() as { n: number }).n).toBe(1);
  const orgs = d.prepare("SELECT o.name FROM ward_plan_orgs x JOIN orgs o ON o.id = x.org_id ORDER BY o.name").all();
  expect(orgs).toEqual([{ name: "Elders Quorum" }, { name: "Relief Society" }]);
});
