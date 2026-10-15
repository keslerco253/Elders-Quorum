import { db } from "./db";
import type { CurrentUser } from "./types";

// Ward plans (temple and family history, ward mission, a youth plan...). Each
// belongs to a ward and is for the whole ward, or for chosen organizations.
// Every save is a new version; the newest is the plan.

export interface WardPlan {
  id: number;
  ward_id: number;
  name: string;
  legacy_kind: string | null;
  /** Organizations it's for; empty means the whole ward. */
  org_ids: number[];
  updated_at: string | null;
}

export interface PlanVersion {
  id: number;
  plan_id: number;
  title: string;
  body: string;
  pdf_file: string | null;
  pdf_name: string | null;
  created_at: string;
  author: string | null;
}

/** Suggested opening text for the two plans every ward starts with. */
export const PLAN_BLURBS: Record<string, string> = {
  temple: "Our ward's goals and ideas for temple worship and family history.",
  mission: "How our ward is inviting others to come unto Christ.",
};

type PlanRow = Omit<WardPlan, "org_ids"> & { org_list: string | null };

const PLAN_SQL = `SELECT p.id, p.ward_id, p.name, p.legacy_kind,
    (SELECT group_concat(org_id) FROM ward_plan_orgs WHERE plan_id = p.id) AS org_list,
    (SELECT MAX(created_at) FROM plan_versions WHERE plan_id = p.id) AS updated_at
  FROM ward_plans p`;

const toPlan = (r: PlanRow): WardPlan => ({
  id: r.id,
  ward_id: r.ward_id,
  name: r.name,
  legacy_kind: r.legacy_kind,
  updated_at: r.updated_at,
  org_ids: r.org_list ? r.org_list.split(",").map(Number) : [],
});

/**
 * Plans to show: in the ward-wide organization every plan; in another
 * organization the whole-ward plans and that organization's own.
 */
export function listPlans(wardId: number, forOrg?: { id: number; kind: string }): WardPlan[] {
  const plans = (db().prepare(`${PLAN_SQL} WHERE p.ward_id = ? ORDER BY p.legacy_kind IS NULL, p.legacy_kind DESC, p.name COLLATE NOCASE`).all(wardId) as PlanRow[]).map(toPlan);
  if (!forOrg || forOrg.kind === "ward") return plans;
  return plans.filter((p) => !p.org_ids.length || p.org_ids.includes(forOrg.id));
}

export function getPlan(wardId: number, id: number): WardPlan | undefined {
  const r = db().prepare(`${PLAN_SQL} WHERE p.ward_id = ? AND p.id = ?`).get(wardId, id) as PlanRow | undefined;
  return r && toPlan(r);
}

/** Old links (/plans/temple, /plans/mission) still work. */
export function planByLegacyKind(wardId: number, kind: string): WardPlan | undefined {
  const r = db().prepare(`${PLAN_SQL} WHERE p.ward_id = ? AND p.legacy_kind = ?`).get(wardId, kind) as PlanRow | undefined;
  return r && toPlan(r);
}

const VERSION_SQL = "SELECT v.*, m.display_name AS author FROM plan_versions v LEFT JOIN members m ON m.id = v.created_by WHERE v.plan_id = ?";

export function currentVersion(planId: number) {
  return db().prepare(VERSION_SQL + " ORDER BY v.id DESC LIMIT 1").get(planId) as PlanVersion | undefined;
}

export function planHistory(planId: number) {
  return db().prepare(VERSION_SQL + " ORDER BY v.id DESC").all(planId) as PlanVersion[];
}

export function planVersion(planId: number, id: number) {
  return db().prepare(VERSION_SQL + " AND v.id = ?").get(planId, id) as PlanVersion | undefined;
}

const leads = (role: string) => role === "admin" || role === "presidency";

/** Organizations in the ward this person leads (admin or presidency). */
export function ledOrgIds(user: CurrentUser): number[] {
  return user.orgs.filter((o) => leads(o.role)).map((o) => o.id);
}

/** Ward leaders (and ward admins) can manage every plan in the ward. */
export const managesWardPlans = (user: CurrentUser) => user.orgs.some((o) => o.kind === "ward" && leads(o.role));

/** Who can edit a plan: ward leaders, or leaders of an organization it's for. */
export function canEditPlan(user: CurrentUser, plan: WardPlan) {
  if (plan.ward_id !== user.ward_id) return false;
  if (managesWardPlans(user)) return true;
  const mine = ledOrgIds(user);
  return plan.org_ids.length > 0 && plan.org_ids.some((id) => mine.includes(id));
}

export const canCreatePlans = (user: CurrentUser) => managesWardPlans(user) || ledOrgIds(user).some((id) => user.orgs.find((o) => o.id === id)?.kind === "group");

/**
 * Who a plan may be for, given who's choosing: ward leaders pick freely
 * (none = whole ward); organization leaders pick among the organizations they
 * lead. Returns null if the choice isn't allowed.
 */
export function allowedAudience(user: CurrentUser, wanted: number[]): number[] | null {
  const groups = user.orgs.filter((o) => o.kind === "group").map((o) => o.id);
  const ids = [...new Set(wanted)].filter((id) => groups.includes(id));
  if (managesWardPlans(user)) return ids;
  const mine = ledOrgIds(user);
  const ok = ids.filter((id) => mine.includes(id));
  return ok.length ? ok : null;
}

export function setAudience(planId: number, orgIds: number[]) {
  const d = db();
  d.prepare("DELETE FROM ward_plan_orgs WHERE plan_id = ?").run(planId);
  const ins = d.prepare("INSERT INTO ward_plan_orgs (plan_id, org_id) VALUES (?, ?)");
  for (const id of orgIds) ins.run(planId, id);
}

export function createPlan(wardId: number, name: string, orgIds: number[], createdBy: number): number {
  const id = Number(db().prepare("INSERT INTO ward_plans (ward_id, name, created_by) VALUES (?, ?, ?)").run(wardId, name, createdBy).lastInsertRowid);
  setAudience(id, orgIds);
  return id;
}

export function saveVersion(v: { planId: number; orgId: number; title: string; body: string; pdfFile: string | null; pdfName: string | null; createdBy: number }) {
  db()
    .prepare("INSERT INTO plan_versions (plan_id, org_id, title, body, pdf_file, pdf_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(v.planId, v.orgId, v.title, v.body, v.pdfFile, v.pdfName, v.createdBy);
  db().prepare("UPDATE ward_plans SET name = ? WHERE id = ?").run(v.title, v.planId);
}

export function deletePlan(planId: number) {
  db().prepare("DELETE FROM ward_plans WHERE id = ?").run(planId);
}

/** "Whole ward", or "Young Men and Young Women". */
export function audienceText(plan: Pick<WardPlan, "org_ids">, orgs: { id: number; label: string }[]) {
  const names = plan.org_ids.map((id) => orgs.find((o) => o.id === id)?.label).filter(Boolean) as string[];
  if (!names.length) return "Whole ward";
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
}
