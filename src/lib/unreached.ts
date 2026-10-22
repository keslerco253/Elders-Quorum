import { db } from "./db";
import { unreachableWhy } from "./delivery";

// The presidency's "Couldn't reach" list (Waiting on you): things a leader sent
// someone that reached them by no means (no app notifications, and no email or
// texts they allow), so someone can tell them in person or by phone.

export interface UnreachedItem {
  id: number;
  member_id: number | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  what: string;
  detail: string;
  url: string;
  created_at: string;
  done_at: string | null;
  done_by_name: string | null;
  /** Why they couldn't be reached. */
  why: string;
}

/** Open items (and, with `done`, ones handled in the last 30 days), newest first. */
export function unreachedItems(orgId: number, done = false): UnreachedItem[] {
  const rows = db()
    .prepare(
      `SELECT u.id, u.member_id, m.display_name AS name, m.phone, m.email, u.what, u.detail, u.url, u.created_at, u.done_at, b.display_name AS done_by_name
       FROM unreached u LEFT JOIN members m ON m.id = u.member_id LEFT JOIN members b ON b.id = u.done_by
       WHERE u.org_id = ? AND ${done ? "u.done_at IS NOT NULL AND u.done_at > datetime('now', '-30 days')" : "u.done_at IS NULL"}
       ORDER BY ${done ? "u.done_at" : "u.created_at"} DESC, u.id DESC LIMIT 200`,
    )
    .all(orgId) as Omit<UnreachedItem, "why">[];
  return rows.map((r) => ({ ...r, why: r.member_id ? unreachableWhy(r.member_id) : "" }));
}

export const unreachedCount = (orgId: number) =>
  (db().prepare("SELECT COUNT(*) AS n FROM unreached WHERE org_id = ? AND done_at IS NULL").get(orgId) as { n: number }).n;

/** Someone told them another way (or it no longer matters). */
export function markUnreachedDone(orgId: number, id: number, byId: number): boolean {
  return db().prepare("UPDATE unreached SET done_at = datetime('now'), done_by = ? WHERE id = ? AND org_id = ? AND done_at IS NULL").run(byId, id, orgId).changes > 0;
}
