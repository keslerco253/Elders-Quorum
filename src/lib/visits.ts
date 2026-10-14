import { db } from "./db";

export const VISIT_TYPES: Record<string, string> = {
  home: "In their home",
  church: "At church",
  phone: "Phone call",
  text: "Text message",
};

export const PRIVACY_NOTE =
  "Keep notes brief. Record nothing you wouldn't normally text to another presidency member, and follow the Church's guidelines on protecting member privacy (General Handbook). Notes are visible to the presidency only.";

export interface VisitRow {
  id: number;
  member_id: number;
  member_name: string;
  date: string;
  type: string;
  notes: string;
  follow_up: number;
  follow_up_done: number;
  visitors: string | null;
}

export function listVisits(orgId: number, opts: { memberId?: number; followUps?: boolean } = {}): VisitRow[] {
  return db()
    .prepare(
      `SELECT v.*, m.display_name AS member_name,
        (SELECT group_concat(pm.display_name, ', ') FROM visit_visitors vv JOIN members pm ON pm.id = vv.member_id WHERE vv.visit_id = v.id) AS visitors
       FROM visits v JOIN members m ON m.id = v.member_id
       WHERE v.org_id = ? ${opts.memberId ? "AND v.member_id = ?" : ""} ${opts.followUps ? "AND v.follow_up = 1 AND v.follow_up_done = 0" : ""}
       ORDER BY v.date DESC, v.id DESC LIMIT 200`,
    )
    .all(...[orgId, ...(opts.memberId ? [opts.memberId] : [])]) as VisitRow[];
}

/** Everyone in the organization's roster with the date of this organization's most recent visit to them. */
export function lastVisitByMember(orgId: number) {
  return db()
    .prepare(
      `SELECT m.id, m.display_name,
        (SELECT max(date) FROM visits v WHERE v.member_id = m.id AND v.org_id = om.org_id AND v.type = 'home') AS last_home,
        (SELECT max(date) FROM visits v WHERE v.member_id = m.id AND v.org_id = om.org_id) AS last_any
       FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
       WHERE m.status = 'active' AND (om.official = 1 OR om.role <> 'member')
       ORDER BY last_home IS NOT NULL, last_home, m.display_name COLLATE NOCASE`,
    )
    .all(orgId) as { id: number; display_name: string; last_home: string | null; last_any: string | null }[];
}
