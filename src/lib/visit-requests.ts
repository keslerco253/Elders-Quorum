import { db } from "./db";

export const REQUEST_KINDS = {
  home: "A visit in my home",
  talk: "A chance to talk (phone or at church)",
  help: "Help with something",
} as const;
export type RequestKind = keyof typeof REQUEST_KINDS;

export const REQUEST_STATUS = {
  open: "Sent",
  scheduled: "Scheduled",
  done: "Visited",
  closed: "Closed",
  cancelled: "Cancelled",
} as const;
export type RequestStatus = keyof typeof REQUEST_STATUS;

export interface VisitRequest {
  id: number;
  org_id: number;
  member_id: number;
  kind: RequestKind;
  best_times: string;
  note: string;
  status: RequestStatus;
  reply: string;
  handled_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface VisitRequestRow extends VisitRequest {
  member_name: string;
  email: string | null;
  phone: string | null;
  handled_by_name: string | null;
}

/** A member's own requests, newest first. */
export function myVisitRequests(memberId: number): VisitRequest[] {
  return db().prepare("SELECT * FROM visit_requests WHERE member_id = ? ORDER BY created_at DESC, id DESC LIMIT 10").all(memberId) as VisitRequest[];
}

/** The presidency's list: open and scheduled requests first, then recently finished ones. */
export function wardVisitRequests(orgId: number, active: boolean): VisitRequestRow[] {
  return db()
    .prepare(
      `SELECT r.*, m.display_name AS member_name, m.email, m.phone, h.display_name AS handled_by_name
       FROM visit_requests r JOIN members m ON m.id = r.member_id LEFT JOIN members h ON h.id = r.handled_by
       WHERE r.org_id = ? AND r.status ${active ? "IN ('open','scheduled')" : "IN ('done','closed','cancelled')"}
       ORDER BY ${active ? "r.status = 'scheduled', r.created_at" : "r.updated_at DESC"}`,
    )
    .all(orgId) as VisitRequestRow[];
}
