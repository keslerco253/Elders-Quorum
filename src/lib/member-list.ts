import { db } from "./db";
import { formatPhone } from "./contact";
import { callingLabel, isCalling, roleLabel, type Member, type Org, type Role } from "./types";

export type ListedMember = Member & { role: Role; calling: string | null; notify: number };

/** Everyone who officially belongs to (or leads) an organization: leaders first, then by name. */
export function orgMemberList(orgId: number, opts: { show?: "active" | "inactive"; q?: string } = {}): ListedMember[] {
  const q = (opts.q ?? "").trim();
  return db()
    .prepare(
      `SELECT m.*, om.role, om.calling, om.notify FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
       WHERE m.status = ? AND (om.official = 1 OR om.role <> 'member')
       AND (? = '' OR m.display_name LIKE '%' || ? || '%')
       ORDER BY om.role = 'member', m.display_name COLLATE NOCASE`,
    )
    .all(orgId, opts.show ?? "active", q, q) as ListedMember[];
}

/** "Elders Quorum President", "Presidency", or "" for members. */
export function positionLabel(m: ListedMember, org: Pick<Org, "kind" | "name">): string {
  if (m.role === "member") return "";
  return isCalling(m.calling) ? callingLabel(m.calling, org) : roleLabel(m.role, org);
}

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The list as CSV (opens in Excel, Numbers or Google Sheets). */
export function memberListCsv(members: ListedMember[], org: Pick<Org, "kind" | "name">, lastSignIn: (m: ListedMember) => string): string {
  const rows = [
    ["Name", "Calling", "Phone", "Email", "Last signed in"],
    ...members.map((m) => [m.display_name, positionLabel(m, org), m.phone ? formatPhone(m.phone) : "", m.email ?? "", lastSignIn(m)]),
  ];
  // A byte-order mark so Excel reads names with accents correctly.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
