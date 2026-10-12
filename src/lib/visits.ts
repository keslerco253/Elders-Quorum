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

export function listVisits(wardId: number, opts: { memberId?: number; followUps?: boolean } = {}): VisitRow[] {
  return db()
    .prepare(
      `SELECT v.*, m.display_name AS member_name,
        (SELECT group_concat(pm.display_name, ', ') FROM visit_visitors vv JOIN members pm ON pm.id = vv.member_id WHERE vv.visit_id = v.id) AS visitors
       FROM visits v JOIN members m ON m.id = v.member_id
       WHERE v.ward_id = ? ${opts.memberId ? "AND v.member_id = ?" : ""} ${opts.followUps ? "AND v.follow_up = 1 AND v.follow_up_done = 0" : ""}
       ORDER BY v.date DESC, v.id DESC LIMIT 200`,
    )
    .all(...[wardId, ...(opts.memberId ? [opts.memberId] : [])]) as VisitRow[];
}

/** Every active member with the date of their most recent presidency home visit. */
export function lastVisitByMember(wardId: number) {
  return db()
    .prepare(
      `SELECT m.id, m.display_name,
        (SELECT max(date) FROM visits v WHERE v.member_id = m.id AND v.type = 'home') AS last_home,
        (SELECT max(date) FROM visits v WHERE v.member_id = m.id) AS last_any
       FROM members m WHERE m.ward_id = ? AND m.status = 'active'
       ORDER BY last_home IS NOT NULL, last_home, m.display_name COLLATE NOCASE`,
    )
    .all(wardId) as { id: number; display_name: string; last_home: string | null; last_any: string | null }[];
}
