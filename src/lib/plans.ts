import { db } from "./db";

export type PlanKind = "temple" | "mission";

export const PLAN_INFO: Record<PlanKind, { title: string; blurb: string }> = {
  temple: { title: "Temple & Family History Plan", blurb: "Our ward's goals and ideas for temple worship and family history." },
  mission: { title: "Ward Mission Plan", blurb: "How our ward is inviting others to come unto Christ." },
};

export const isPlanKind = (v: string): v is PlanKind => v === "temple" || v === "mission";

export interface PlanVersion {
  id: number;
  kind: PlanKind;
  title: string;
  body: string;
  pdf_file: string | null;
  pdf_name: string | null;
  created_at: string;
  author: string | null;
}

const SQL = "SELECT p.*, m.display_name AS author FROM plans p LEFT JOIN members m ON m.id = p.created_by WHERE p.org_id = ? AND p.kind = ?";

export function currentPlan(orgId: number, kind: PlanKind) {
  return db().prepare(SQL + " ORDER BY p.id DESC LIMIT 1").get(orgId, kind) as PlanVersion | undefined;
}

export function planHistory(orgId: number, kind: PlanKind) {
  return db().prepare(SQL + " ORDER BY p.id DESC").all(orgId, kind) as PlanVersion[];
}

export function planVersion(orgId: number, kind: PlanKind, id: number) {
  return db().prepare(SQL + " AND p.id = ?").get(orgId, kind, id) as PlanVersion | undefined;
}
