import { db } from "./db";
import type { Ward } from "./types";

export const DEFAULT_APP_NAME = "Elders Quorum";

export function listWards(): Ward[] {
  return db().prepare("SELECT id, name, timezone FROM wards ORDER BY name").all() as Ward[];
}

export function getWard(id: number): Ward | undefined {
  return db().prepare("SELECT id, name, timezone FROM wards WHERE id = ?").get(id) as Ward | undefined;
}

/** Name shown before sign-in: the single ward's name, or a generic name if there are several. */
export function publicAppName() {
  const wards = listWards();
  return wards.length === 1 ? wards[0].name : DEFAULT_APP_NAME;
}

export function needsSetup() {
  const row = db().prepare("SELECT COUNT(*) AS n FROM members WHERE role = 'presidency' AND status = 'active'").get() as { n: number };
  return row.n === 0;
}
