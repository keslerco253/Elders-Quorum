import { db } from "./db";
import { isLastPresidency } from "./accounts";
import { regularTeachers, saveRegularTeachers, WEEKS } from "./regular-teachers";

// Callings an organization adds itself (Assistant Activities Coordinator, Teacher…),
// beyond the presidency callings in CALLINGS. A person can hold several. A calling can
// give Leadership access while it's held, and a teaching calling sets which Sundays of
// the month the person teaches (the same regular teachers as Manage lessons).

export const MAX_CALLINGS = 40;
export const MAX_CALLING_NAME = 60;

export interface OrgCalling {
  id: number;
  name: string;
  leader: number;
  teaches: number;
  holders: { member_id: number; display_name: string; weeks: number[] }[];
}

export function orgCallings(orgId: number): OrgCalling[] {
  const d = db();
  const callings = d.prepare("SELECT id, name, leader, teaches FROM org_callings WHERE org_id = ? ORDER BY name COLLATE NOCASE").all(orgId) as Omit<OrgCalling, "holders">[];
  const holders = d
    .prepare(
      `SELECT mc.calling_id, m.id AS member_id, m.display_name FROM member_callings mc JOIN members m ON m.id = mc.member_id
       JOIN org_callings c ON c.id = mc.calling_id WHERE c.org_id = ? ORDER BY m.display_name COLLATE NOCASE`,
    )
    .all(orgId) as { calling_id: number; member_id: number; display_name: string }[];
  const regular = regularTeachers(orgId);
  return callings.map((c) => ({
    ...c,
    holders: holders
      .filter((h) => h.calling_id === c.id)
      .map((h) => ({ member_id: h.member_id, display_name: h.display_name, weeks: regular.filter((r) => r.member_id === h.member_id).map((r) => r.week) })),
  }));
}

export function getOrgCalling(orgId: number, id: number) {
  return db().prepare("SELECT id, name, leader, teaches FROM org_callings WHERE id = ? AND org_id = ?").get(id, orgId) as Omit<OrgCalling, "holders"> | undefined;
}

/** The added callings each person in the organization holds, by member id. */
export function callingNamesByMember(orgId: number): Map<number, string[]> {
  const rows = db()
    .prepare("SELECT mc.member_id, c.name FROM member_callings mc JOIN org_callings c ON c.id = mc.calling_id WHERE c.org_id = ? ORDER BY c.name COLLATE NOCASE")
    .all(orgId) as { member_id: number; name: string }[];
  const by = new Map<number, string[]>();
  for (const r of rows) by.set(r.member_id, [...(by.get(r.member_id) ?? []), r.name]);
  return by;
}

/**
 * Gives or takes back Leadership access to match the person's added callings: holding
 * one that gives it makes a member a leader; once they hold none, access given that way
 * goes back to Member (unless they're the organization's last leader).
 */
export function syncLeaderAccess(orgId: number, memberId: number) {
  const d = db();
  const row = d.prepare("SELECT role, leader_by_calling FROM org_members WHERE org_id = ? AND member_id = ?").get(orgId, memberId) as
    | { role: string; leader_by_calling: number }
    | undefined;
  if (!row) return;
  const leads = !!d
    .prepare("SELECT 1 FROM member_callings mc JOIN org_callings c ON c.id = mc.calling_id WHERE c.org_id = ? AND mc.member_id = ? AND c.leader = 1")
    .get(orgId, memberId);
  if (leads && row.role === "member") d.prepare("UPDATE org_members SET role = 'presidency', calling = NULL, leader_by_calling = 1 WHERE org_id = ? AND member_id = ?").run(orgId, memberId);
  else if (!leads && row.leader_by_calling && row.role === "presidency" && !isLastPresidency(orgId, memberId))
    d.prepare("UPDATE org_members SET role = 'member', calling = NULL, leader_by_calling = 0 WHERE org_id = ? AND member_id = ?").run(orgId, memberId);
}

/** Everyone holding the calling, for re-checking their access after it changes. */
export function callingHolderIds(callingId: number): number[] {
  return (db().prepare("SELECT member_id FROM member_callings WHERE calling_id = ?").all(callingId) as { member_id: number }[]).map((r) => r.member_id);
}

/**
 * Sets which Sundays of the month someone teaches. A Sunday another person had moves
 * to them; Sundays they had and no longer want open up. Returns saveRegularTeachers'
 * changes, to tell the teachers.
 */
export function setTeacherWeeks(orgId: number, memberId: number, weeks: number[], today: string) {
  const current = new Map(regularTeachers(orgId).map((r) => [r.week, r.member_id]));
  const byWeek = WEEKS.map((w) => (weeks.includes(w) ? memberId : current.get(w) === memberId ? null : (current.get(w) ?? null)));
  return saveRegularTeachers(orgId, byWeek, today);
}

/** Someone who no longer holds a teaching calling stops being a regular teacher. */
export function stopTeachingIfNone(orgId: number, memberId: number, today: string) {
  const teaches = db()
    .prepare("SELECT 1 FROM member_callings mc JOIN org_callings c ON c.id = mc.calling_id WHERE c.org_id = ? AND mc.member_id = ? AND c.teaches = 1")
    .get(orgId, memberId);
  return teaches ? null : setTeacherWeeks(orgId, memberId, [], today);
}
