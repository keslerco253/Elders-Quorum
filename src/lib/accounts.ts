import { db } from "./db";

/**
 * Permanently deletes a member's account and everything they contributed
 * (comments, sign-ups, RSVPs, requests, devices). Records they created as an
 * admin (events, lessons) stay but no longer point to them.
 */
export function deleteAccount(memberId: number) {
  const d = db();
  d.transaction(() => {
    for (const [table, col] of [
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

/**
 * Whether a ward's leaders may change this person's name, phone or email (which
 * they sign in with): only for someone who has never signed in and belongs to no
 * other ward. Anyone else changes their own, with a code, under More → Contact.
 * Otherwise a leader of any ward could add someone, change their email to their
 * own, and sign in as them.
 */
export function leaderCanEditContact(memberId: number, wardId: number): boolean {
  const m = db().prepare("SELECT last_login_at, is_site_owner, email FROM members WHERE id = ?").get(memberId) as { last_login_at: string | null; is_site_owner: number; email: string | null } | undefined;
  if (m && isOwnerEmail(m.email)) return false;
  // Never a leader anywhere either: taking over their account would take over what they lead.
  const leads = db().prepare("SELECT 1 FROM org_members WHERE member_id = ? AND role = 'presidency'").get(memberId);
  return !!m && !m.last_login_at && !m.is_site_owner && !leads && onlyInWard(memberId, wardId);
}

/** Belongs to this ward and no other (so turning their account off affects only this ward). */
export function onlyInWard(memberId: number, wardId: number): boolean {
  const wards = db().prepare("SELECT ward_id FROM ward_members WHERE member_id = ?").all(memberId) as { ward_id: number }[];
  return wards.length > 0 && wards.every((w) => w.ward_id === wardId);
}

/** The site owner's email (OWNER_EMAIL), which only the site owner may give an account. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return !!owner && !!email && email.toLowerCase() === owner;
}
