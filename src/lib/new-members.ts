import { db } from "./db";

// New people in a ward, for its ward administrators to look over: someone who joined
// with the code but doesn't belong can be taken out. Everyone already in the ward when
// this started counts as reviewed.

/** How far back the list goes. */
export const NEW_MEMBER_DAYS = 90;

export interface NewMember {
  id: number;
  display_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  /** How they came: joined with the code, added by a leader, or an account they already had. */
  how: "code" | "leader" | "existing";
  joined_at: string;
  last_login_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  /** The organizations they belong to in this ward. */
  orgs: string[];
  /** In another ward too. */
  other_wards: number;
}

export function newWardMembers(wardId: number, opts: { toReviewOnly?: boolean } = {}): NewMember[] {
  const d = db();
  const rows = d
    .prepare(
      `SELECT m.id, m.display_name, m.email, m.phone, m.status, m.source, m.created_at AS member_created, m.last_login_at,
         wm.created_at AS joined_at, wm.reviewed_at, r.display_name AS reviewed_by_name,
         (SELECT COUNT(*) FROM ward_members x WHERE x.member_id = m.id AND x.ward_id <> wm.ward_id) AS other_wards
       FROM ward_members wm JOIN members m ON m.id = wm.member_id LEFT JOIN members r ON r.id = wm.reviewed_by
       WHERE wm.ward_id = ? AND wm.created_at > datetime('now', ?) ${opts.toReviewOnly ? "AND wm.reviewed_at IS NULL" : ""}
       ORDER BY wm.reviewed_at IS NOT NULL, wm.created_at DESC`,
    )
    .all(wardId, `-${NEW_MEMBER_DAYS} days`) as (Omit<NewMember, "how" | "orgs"> & { source: string; member_created: string })[];
  const orgsOf = d.prepare(
    `SELECT o.name FROM org_members om JOIN orgs o ON o.id = om.org_id
     WHERE om.member_id = ? AND o.ward_id = ? AND o.kind = 'group' AND (om.official = 1 OR om.role <> 'member') ORDER BY o.name`,
  );
  return rows.map(({ source, member_created, ...r }) => ({
    ...r,
    // A new account made within a minute of joining came from the join page.
    how: source === "manual" ? "leader" : source === "request" && Math.abs(Date.parse(member_created.replace(" ", "T") + "Z") - Date.parse(r.joined_at.replace(" ", "T") + "Z")) < 60_000 ? "code" : "existing",
    orgs: (orgsOf.all(r.id, wardId) as { name: string }[]).map((o) => o.name),
  }));
}

export function newMembersToReview(wardId: number): number {
  return (
    db()
      .prepare("SELECT COUNT(*) AS n FROM ward_members WHERE ward_id = ? AND reviewed_at IS NULL AND created_at > datetime('now', ?)")
      .get(wardId, `-${NEW_MEMBER_DAYS} days`) as { n: number }
  ).n;
}

export function markNewMemberReviewed(wardId: number, memberId: number, by: number): boolean {
  return (
    db().prepare("UPDATE ward_members SET reviewed_at = datetime('now'), reviewed_by = ? WHERE ward_id = ? AND member_id = ? AND reviewed_at IS NULL").run(by, wardId, memberId)
      .changes > 0
  );
}
