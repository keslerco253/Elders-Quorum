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

/** True if this member is the organization's only active presidency member. */
export function isLastPresidency(orgId: number, memberId: number) {
  const r = db()
    .prepare("SELECT COUNT(*) AS n FROM org_members om JOIN members m ON m.id = om.member_id WHERE om.org_id = ? AND om.role = 'presidency' AND m.status = 'active' AND m.id != ?")
    .get(orgId, memberId) as { n: number };
  const me = db().prepare("SELECT om.role, m.status FROM org_members om JOIN members m ON m.id = om.member_id WHERE om.org_id = ? AND m.id = ?").get(orgId, memberId) as
    | { role: string; status: string }
    | undefined;
  return me?.role === "presidency" && me.status === "active" && r.n === 0;
}

/** Organizations (ids) this member is the only presidency member of, within one ward or anywhere. */
export function onlyLeaderOf(memberId: number, wardId?: number): number[] {
  const orgs = db()
    .prepare(`SELECT om.org_id FROM org_members om JOIN orgs o ON o.id = om.org_id WHERE om.member_id = ? AND om.role = 'presidency' ${wardId ? "AND o.ward_id = ?" : ""}`)
    .all(...(wardId ? [memberId, wardId] : [memberId])) as { org_id: number }[];
  return orgs.map((o) => o.org_id).filter((id) => isLastPresidency(id, memberId));
}

/** Takes a member out of one organization (they stay in the ward). */
export function removeFromOrg(memberId: number, orgId: number) {
  db().prepare("DELETE FROM org_members WHERE org_id = ? AND member_id = ?").run(orgId, memberId);
}

/**
 * Takes a member out of a ward and all its organizations. Someone left in no
 * ward at all has their account deleted. Returns true if it was deleted.
 */
export function removeFromWard(memberId: number, wardId: number): boolean {
  const d = db();
  d.prepare("DELETE FROM org_members WHERE member_id = ? AND org_id IN (SELECT id FROM orgs WHERE ward_id = ?)").run(memberId, wardId);
  d.prepare("DELETE FROM ward_members WHERE member_id = ? AND ward_id = ?").run(memberId, wardId);
  if (d.prepare("SELECT 1 FROM ward_members WHERE member_id = ?").get(memberId)) return false;
  deleteAccount(memberId);
  return true;
}
