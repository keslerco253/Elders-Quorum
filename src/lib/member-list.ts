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
export type MemberSort = "leaders" | "first" | "last";
export const memberSort = (v: unknown): MemberSort => (v === "first" || v === "last" ? v : "leaders");

const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
/** "Mark A. Johnson Jr." → first "Mark", last "Johnson"; "Johnson, Mark" works too. */
export function nameParts(name: string): { first: string; last: string; rest: string } {
  const n = name.replace(/\s+/g, " ").trim();
  const comma = n.indexOf(",");
  if (comma > 0 && !SUFFIX.test(n.slice(comma + 1).trim())) {
    const rest = n.slice(comma + 1).trim();
    return { first: rest.split(" ")[0] ?? "", last: n.slice(0, comma).trim(), rest };
  }
  const words = n.replace(/,/g, "").split(" ");
  while (words.length > 2 && SUFFIX.test(words.at(-1)!)) words.pop();
  const last = words.length > 1 ? words.at(-1)! : "";
  return { first: words[0] ?? "", last, rest: words.slice(0, -1).join(" ") };
}

/** Shown as "Johnson, Mark A." when the list is sorted by last name. */
export const lastFirst = (name: string) => {
  const p = nameParts(name);
  return p.last ? `${p.last}, ${p.rest}` : name;
};

const byText = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

export function orgMemberList(orgId: number, opts: { show?: MemberShow; q?: string; sort?: MemberSort } = {}): ListedMember[] {
  const q = (opts.q ?? "").trim();
  const noOrg =
    opts.show === "noorg"
      ? `AND NOT EXISTS (SELECT 1 FROM org_members x JOIN orgs o ON o.id = x.org_id
           WHERE x.member_id = m.id AND o.ward_id = (SELECT ward_id FROM orgs WHERE id = @org) AND o.kind = 'group' AND o.active = 1 AND (x.official = 1 OR x.role <> 'member'))`
      : "";
  const list = db()
    .prepare(
      `SELECT m.*, om.role, om.calling, om.notify FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = @org
       WHERE m.status = @status AND (om.official = 1 OR om.role <> 'member' OR @noorg = 1)
       AND (@q = '' OR m.display_name LIKE '%' || @q || '%') ${noOrg}
       ORDER BY om.role = 'member', m.display_name COLLATE NOCASE`,
    )
    .all({ org: orgId, status: opts.show === "inactive" ? "inactive" : "active", q, noorg: opts.show === "noorg" ? 1 : 0 }) as ListedMember[];
  // By first or last name: everyone together, A to Z (otherwise leaders come first).
  if (opts.sort === "first") return list.sort((a, b) => byText(a.display_name, b.display_name));
  if (opts.sort === "last") {
    const key = new Map(list.map((m) => [m.id, nameParts(m.display_name)]));
    return list.sort((a, b) => byText(key.get(a.id)!.last || key.get(a.id)!.first, key.get(b.id)!.last || key.get(b.id)!.first) || byText(key.get(a.id)!.rest, key.get(b.id)!.rest));
  }
  return list;
}

/**
 * People who get an organization's notifications without belonging to it (a parent
 * following Young Women): not on its member list, so shown to its leaders separately.
 */
export function orgFollowers(orgId: number): { id: number; display_name: string }[] {
  return db()
    .prepare(
      `SELECT m.id, m.display_name FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
       WHERE m.status = 'active' AND om.official = 0 AND om.role = 'member' AND om.notify = 1
       ORDER BY m.display_name COLLATE NOCASE`,
    )
    .all(orgId) as { id: number; display_name: string }[];
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
    ["Name", "First name", "Last name", "Calling", "Phone", "Email", "Last signed in"],
    ...members.map((m) => [m.display_name, nameParts(m.display_name).first, nameParts(m.display_name).last, positionLabel(m, org), m.phone ? formatPhone(m.phone) : "", m.email ?? "", lastSignIn(m)]),
  ];
  // A byte-order mark so Excel reads names with accents correctly.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
