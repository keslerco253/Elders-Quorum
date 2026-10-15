import { db } from "./db";
import { getWard, listWards } from "./orgs";
import type { Ward } from "./types";

export { getWard, listWards };

export const DEFAULT_APP_NAME = "My Ward Link";

/** Name shown before sign-in (sign-in page, installed app, privacy and terms): the app's own name, since many wards use it. */
export function publicAppName() {
  return DEFAULT_APP_NAME;
}

/** No one leads anything yet: the server is brand new (first-time setup). */
export function needsSetup() {
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM org_members om JOIN members m ON m.id = om.member_id WHERE om.role = 'presidency' AND m.status = 'active'")
    .get() as { n: number };
  return row.n === 0;
}

export function wardByJoinCode(code: string): Ward | undefined {
  const c = code.trim();
  if (!c) return undefined;
  return db().prepare("SELECT id, name, timezone, join_code, sms_monthly_limit, created_by, texting_enabled FROM wards WHERE join_code = ? COLLATE NOCASE").get(c) as Ward | undefined;
}
