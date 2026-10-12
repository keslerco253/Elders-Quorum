import { db } from "./db";

/**
 * Permanently deletes a member's account and everything they contributed
 * (comments, sign-ups, RSVPs, requests, devices). Records they created as an
 * admin (events, plans, lessons) stay but no longer point to them.
 */
export function deleteAccount(memberId: number) {
  const d = db();
  d.transaction(() => {
    for (const [table, col] of [
      ["plans", "created_by"],
      ["events", "created_by"],
      ["messages", "sender_id"],
      ["signups", "created_by"],
      ["todos", "created_by"],
      ["visits", "created_by"],
      ["comments", "reviewed_by"],
      ["event_requests", "decided_by"],
    ]) {
      d.prepare(`UPDATE ${table} SET ${col} = NULL WHERE ${col} = ?`).run(memberId);
    }
    // Everything else references members with ON DELETE CASCADE / SET NULL.
    d.prepare("DELETE FROM members WHERE id = ?").run(memberId);
  })();
}

/** True if removing this member would leave the ward with no active presidency. */
export function isLastPresidency(wardId: number, memberId: number) {
  const r = db()
    .prepare("SELECT COUNT(*) AS n FROM members WHERE ward_id = ? AND role = 'presidency' AND status = 'active' AND id != ?")
    .get(wardId, memberId) as { n: number };
  const me = db().prepare("SELECT role, status FROM members WHERE id = ?").get(memberId) as { role: string; status: string } | undefined;
  return me?.role === "presidency" && me.status === "active" && r.n === 0;
}
