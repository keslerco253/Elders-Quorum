import { db } from "./db";
import { formatPhone } from "./contact";
import { callingLabel, isCalling, roleLabel, type Member, type Org, type Role } from "./types";

export type ListedMember = Member & { role: Role; calling: string | null; notify: number };

/** Everyone who officially belongs to (or leads) an organization: leaders first, then by name. */
export type MemberShow = "active" | "inactive" | "noorg";
export const memberShow = (v: unknown): MemberShow => (v === "inactive" || v === "noorg" ? v : "active");

/**
 * An organization's members (active or turned off). For the ward-wide organization,
 * "noorg" is everyone active in the ward who hasn't chosen (or been put in) any of its
 * organizations (Elders Quorum, Relief Society…).
 */
export function orgMemberList(orgId: number, opts: { show?: MemberShow; q?: string } = {}): ListedMember[] {
  const q = (opts.q ?? "").trim();
  const noOrg =
    opts.show === "noorg"
      ? `AND NOT EXISTS (SELECT 1 FROM org_members x JOIN orgs o ON o.id = x.org_id
           WHERE x.member_id = m.id AND o.ward_id = (SELECT ward_id FROM orgs WHERE id = @org) AND o.kind = 'group' AND o.active = 1 AND (x.official = 1 OR x.role <> 'member'))`
      : "";
  return db()
    .prepare(
      `SELECT m.*, om.role, om.calling, om.notify FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = @org
       WHERE m.status = @status AND (om.official = 1 OR om.role <> 'member' OR @noorg = 1)
       AND (@q = '' OR m.display_name LIKE '%' || @q || '%') ${noOrg}
       ORDER BY om.role = 'member', m.display_name COLLATE NOCASE`,
    )
    .all({ org: orgId, status: opts.show === "inactive" ? "inactive" : "active", q, noorg: opts.show === "noorg" ? 1 : 0 }) as ListedMember[];
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
