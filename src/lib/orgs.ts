// Wards, the organizations in them, and each member's place in those.
import crypto from "crypto";
import { db } from "./db";
import { deleteAccount } from "./accounts";
export { ORG_COOKIE } from "./org-cookie";
import { isCalling, STANDARD_ORGS, type Calling, type CurrentUser, type Feature, type Member, type Org, type OrgEntry, type Role, type Ward } from "./types";

const WARD_COLUMNS = "id, name, timezone, join_code, sms_monthly_limit, created_by, texting_enabled, pending, stake, request_note, reply_backup_id, no_texting, texting_paid_through";
const ORG_COLUMNS = "id, ward_id, name, kind, hidden_features, active";

export function getWard(id: number): Ward | undefined {
  return db().prepare(`SELECT ${WARD_COLUMNS} FROM wards WHERE id = ?`).get(id) as Ward | undefined;
}

export function listWards(): Ward[] {
  return db().prepare(`SELECT ${WARD_COLUMNS} FROM wards ORDER BY name`).all() as Ward[];
}

export function getOrg(id: number): Org | undefined {
  return db().prepare(`SELECT ${ORG_COLUMNS} FROM orgs WHERE id = ?`).get(id) as Org | undefined;
}

/** The ward-wide organization first, then the others by name. */
/** The ward's organizations in use (or all of them, including turned off ones). */
export function orgsInWard(wardId: number, opts: { includeInactive?: boolean } = {}): Org[] {
  return db()
    .prepare(`SELECT ${ORG_COLUMNS} FROM orgs WHERE ward_id = ? AND (active = 1 OR ?) ORDER BY kind = 'group', name COLLATE NOCASE`)
    .all(wardId, opts.includeInactive ? 1 : 0) as Org[];
}

export function wardOrg(wardId: number): Org {
  return db().prepare(`SELECT ${ORG_COLUMNS} FROM orgs WHERE ward_id = ? AND kind = 'ward'`).get(wardId) as Org;
}

/** "Elders Quorum", or the ward's own name for the ward-wide organization. */
export function orgLabel(org: Org, ward?: Pick<Ward, "name">): string {
  return org.kind === "ward" ? (ward ?? getWard(org.ward_id))?.name ?? "Ward" : org.name;
}

/** "Villas Ward Elders Quorum": for texts and emails, where the ward isn't obvious. */
export function orgFullName(orgId: number): string {
  const row = db().prepare("SELECT o.name, o.kind, w.name AS ward FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE o.id = ?").get(orgId) as
    | { name: string; kind: string; ward: string }
    | undefined;
  if (!row) return "Ward";
  return row.kind === "ward" ? row.ward : `${row.ward} ${row.name}`;
}

/** "the Elders Quorum presidency", "the bishopric": for wording in invitations. */
export const leadersPhrase = (org: Pick<Org, "kind" | "name">) => (org.kind === "ward" ? "the bishopric" : `the ${org.name} presidency`);

export const hasFeature = (org: Pick<Org, "hidden_features">, f: Feature) => !org.hidden_features.split(",").includes(f);

export function memberWards(memberId: number): Ward[] {
  return db()
    .prepare(`SELECT ${WARD_COLUMNS.split(", ").map((c) => "w." + c).join(", ")} FROM wards w JOIN ward_members wm ON wm.ward_id = w.id WHERE wm.member_id = ? ORDER BY w.name`)
    .all(memberId) as Ward[];
}

export function inWard(memberId: number, wardId: number): boolean {
  return !!db().prepare("SELECT 1 FROM ward_members WHERE ward_id = ? AND member_id = ?").get(wardId, memberId);
}

interface MembershipRow {
  org_id: number;
  role: Role;
  calling: string | null;
  official: number;
  notify: number;
}

/** The member's role in an organization ("member" if they have no row there). */
export function roleIn(memberId: number, orgId: number): Role {
  return ((db().prepare("SELECT role FROM org_members WHERE org_id = ? AND member_id = ?").get(orgId, memberId) as { role: Role } | undefined)?.role ?? "member");
}

/** Adds a member to a ward and its ward-wide organization (no-op if already there). */
export function addToWard(memberId: number, wardId: number) {
  const d = db();
  d.prepare("INSERT OR IGNORE INTO ward_members (ward_id, member_id) VALUES (?, ?)").run(wardId, memberId);
  d.prepare("INSERT OR IGNORE INTO org_members (org_id, member_id) VALUES (?, ?)").run(wardOrg(wardId).id, memberId);
}

/** Adds a member to an organization (in a ward they're in), keeping any role they have. */
export function addToOrg(memberId: number, orgId: number, opts: { role?: Role; calling?: Calling | null; official?: boolean; notify?: boolean } = {}) {
  const org = getOrg(orgId);
  if (!org) return;
  addToWard(memberId, org.ward_id);
  const d = db();
  d.prepare("INSERT OR IGNORE INTO org_members (org_id, member_id, official, notify) VALUES (?, ?, ?, ?)").run(orgId, memberId, opts.official === false ? 0 : 1, opts.notify === false ? 0 : 1);
  if (opts.role) d.prepare("UPDATE org_members SET role = ?, calling = ? WHERE org_id = ? AND member_id = ?").run(opts.role, opts.calling ?? null, orgId, memberId);
}


/**
 * Which organization to show: the one asked for if the member is in its
 * ward, else one they lead, else one they officially belong to, else their
 * ward-wide organization.
 */
export function pickOrg(memberId: number, wanted?: number): Org | undefined {
  const d = db();
  if (wanted) {
    const org = getOrg(wanted);
    if (org && org.active && inWard(memberId, org.ward_id)) return org;
  }
  const row = d
    .prepare(
      `SELECT o.id FROM org_members om JOIN orgs o ON o.id = om.org_id
       JOIN ward_members wm ON wm.ward_id = o.ward_id AND wm.member_id = om.member_id
       WHERE om.member_id = ? AND o.active = 1
       ORDER BY om.role = 'presidency' DESC, om.role = 'admin' DESC, (om.official = 1 AND o.kind = 'group') DESC, o.kind = 'ward' DESC, o.id
       LIMIT 1`,
    )
    .get(memberId) as { id: number } | undefined;
  return row ? getOrg(row.id) : undefined;
}

/** The member's main organization and ward name, for messages not about any one organization. */
export function homeOf(memberId: number): { orgId: number | null; name: string } {
  const org = pickOrg(memberId);
  return org ? { orgId: org.id, name: getWard(org.ward_id)?.name ?? "My Ward Link" } : { orgId: null, name: "My Ward Link" };
}

/** Builds the signed-in user as seen from an organization. Null if they belong to no ward. */
/** The site owner: marked in the database, or the email in the OWNER_EMAIL setting. */
export function isSiteOwner(member: Pick<Member, "is_site_owner" | "email" | "email_verified_at">): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  // OWNER_EMAIL only counts once a code or link sent to it was used (so it can't be planted on another account).
  return !!member.is_site_owner || (!!owner && member.email?.toLowerCase() === owner && !!member.email_verified_at);
}

export function currentUserFor(member: Member, wantedOrg?: number): CurrentUser | null {
  member = { ...member, is_site_owner: isSiteOwner(member) ? 1 : 0 };
  const org = pickOrg(member.id, wantedOrg);
  if (!org) return null;
  const ward = getWard(org.ward_id)!;
  const rows = db().prepare("SELECT org_id, role, calling, official, notify FROM org_members WHERE member_id = ?").all(member.id) as MembershipRow[];
  const byOrg = new Map(rows.map((r) => [r.org_id, r]));
  const orgs: OrgEntry[] = orgsInWard(ward.id).map((o) => {
    const r = byOrg.get(o.id);
    return {
      ...o,
      label: orgLabel(o, ward),
      role: r?.role ?? "member",
      calling: r && isCalling(r.calling) ? r.calling : null,
      joined: !!r,
      official: !!r?.official,
      notify: !!r?.notify,
    };
  });
  const here = orgs.find((o) => o.id === org.id)!;
  const wardEntry = orgs.find((o) => o.kind === "ward");
  return {
    ...member,
    ward,
    ward_id: ward.id,
    org,
    org_id: org.id,
    orgLabel: here.label,
    role: here.role,
    calling: here.calling,
    orgs,
    wards: memberWards(member.id),
    wardLeader: wardEntry?.role === "presidency" || ward.created_by === member.id,
    wardAdmin: isWardAdmin(member, ward.id, wardEntry?.role === "presidency" || ward.created_by === member.id),
  };
}

/** Selects members in an organization, with their role there as m.role / m.calling. */
export const ORG_MEMBERS_FROM = "members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A random 6-character join code no other ward uses. */
export function newJoinCode(): string {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join("");
    if (!db().prepare("SELECT 1 FROM wards WHERE join_code = ? COLLATE NOCASE").get(code)) return code;
  }
}

/**
 * A new ward with its ward-wide organization. The person who creates it leads
 * that organization (with the bishopric, once they're added).
 */
export function createWard(opts: { name: string; timezone: string; creatorId: number; calling?: Calling | null; texting?: boolean; noTexting?: boolean; pending?: { stake: string; note: string } }): Ward {
  const d = db();
  return d.transaction(() => {
    const wardId = Number(
      d
        .prepare("INSERT INTO wards (name, timezone, join_code, created_by, texting_enabled, no_texting, pending, stake, request_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(opts.name, opts.timezone, newJoinCode(), opts.creatorId, opts.texting && !opts.noTexting ? 1 : 0, opts.noTexting ? 1 : 0, opts.pending ? 1 : 0, opts.pending?.stake ?? "", opts.pending?.note ?? "").lastInsertRowid,
    );
    // The ward level starts without lessons (organizations have those), and
    // with the two plans every ward keeps.
    d.prepare("INSERT INTO orgs (ward_id, name, kind, hidden_features) VALUES (?, 'Ward', 'ward', 'lessons')").run(wardId);
    const addOrg = d.prepare("INSERT INTO orgs (ward_id, name, kind) VALUES (?, ?, 'group')");
    for (const name of STANDARD_ORGS) addOrg.run(wardId, name);
    d.prepare("INSERT INTO ward_plans (ward_id, name, legacy_kind) VALUES (?, 'Temple & Family History Plan', 'temple'), (?, 'Ward Mission Plan', 'mission')").run(wardId, wardId);
    addToWard(opts.creatorId, wardId);
    d.prepare("UPDATE org_members SET role = 'presidency', calling = ? WHERE org_id = ? AND member_id = ?").run(opts.calling ?? null, wardOrg(wardId).id, opts.creatorId);
    return getWard(wardId)!;
  })();
}

/** A new organization in a ward; the person creating it is added to its presidency if they ask. */
export function createOrg(wardId: number, name: string, hidden: string[] = []): Org {
  const id = Number(db().prepare("INSERT INTO orgs (ward_id, name, kind, hidden_features) VALUES (?, ?, 'group', ?)").run(wardId, name, hidden.join(",")).lastInsertRowid);
  return getOrg(id)!;
}

export interface Person {
  id: number;
  display_name: string;
}

/**
 * The organization's roster, for leaders choosing people (teachers, visits,
 * groups, messages): everyone who officially belongs or leads it.
 */
export function orgRoster(orgId: number, opts: { includeId?: number } = {}): Person[] {
  return db()
    .prepare(
      `SELECT m.id, m.display_name FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
       WHERE (m.status = 'active' AND (om.official = 1 OR om.role <> 'member')) OR m.id = ?
       ORDER BY m.display_name COLLATE NOCASE`,
    )
    .all(orgId, opts.includeId ?? 0) as Person[];
}

/** The organization's presidency (bishopric for the ward). */
export function orgPresidency(orgId: number): Person[] {
  return db()
    .prepare(
      `SELECT m.id, m.display_name FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
       WHERE om.role = 'presidency' AND m.status = 'active' ORDER BY m.display_name COLLATE NOCASE`,
    )
    .all(orgId) as Person[];
}

/** Whether a member is in the organization's ward (so leaders may visit, teach, message them). */
export function inOrgWard(memberId: number, orgId: number): boolean {
  return !!db().prepare("SELECT 1 FROM ward_members wm JOIN orgs o ON o.ward_id = wm.ward_id WHERE o.id = ? AND wm.member_id = ?").get(orgId, memberId);
}

/** A member (any status) in the organization's ward. */
export function wardMember(memberId: number, orgId: number): Member | undefined {
  return db()
    .prepare("SELECT m.* FROM members m JOIN ward_members wm ON wm.member_id = m.id JOIN orgs o ON o.ward_id = wm.ward_id WHERE o.id = ? AND m.id = ?")
    .get(orgId, memberId) as Member | undefined;
}

/** A ward member as seen from one organization: their role there, if any. */
export type OrgMemberView = Member & { role: Role; calling: Calling | null; official: number; notify: number; in_org: number };

export function orgMemberView(orgId: number, memberId: number): OrgMemberView | undefined {
  const m = wardMember(memberId, orgId);
  if (!m) return undefined;
  const r = db().prepare("SELECT role, calling, official, notify FROM org_members WHERE org_id = ? AND member_id = ?").get(orgId, memberId) as MembershipRow | undefined;
  return { ...m, role: r?.role ?? "member", calling: r && isCalling(r.calling) ? r.calling : null, official: r?.official ?? 0, notify: r?.notify ?? 0, in_org: r ? 1 : 0 };
}

export function orgTimezone(orgId: number): string {
  return (db().prepare("SELECT w.timezone FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE o.id = ?").get(orgId) as { timezone: string } | undefined)?.timezone ?? "America/Boise";
}

/** Tables holding an organization's things, children before parents. */
const ORG_TABLES = [
  "teaching_requests",
  "planned_visits",
  "visit_requests",
  "member_messages",
  "events",
  "event_series",
  "event_requests",
  "lessons",
  "visits",
  "groups",
  "messages",
  "signups",
  "todos",
  "agenda_items",
  "meetings",
  "sms_log",
  "message_templates",
];

/**
 * Deletes a ward, its organizations and everything in them (site owner, e.g. a
 * ward started by mistake or misused). People left in no ward are deleted too.
 */
export function deleteWard(wardId: number): { accounts: number } {
  const d = db();
  return d.transaction(() => {
    const people = (d.prepare("SELECT member_id FROM ward_members WHERE ward_id = ?").all(wardId) as { member_id: number }[]).map((r) => r.member_id);
    for (const o of orgsInWard(wardId, { includeInactive: true })) {
      for (const t of ORG_TABLES) d.prepare(`DELETE FROM ${t} WHERE org_id = ?`).run(o.id);
      d.prepare("DELETE FROM orgs WHERE id = ?").run(o.id);
    }
    d.prepare("DELETE FROM ward_members WHERE ward_id = ?").run(wardId);
    d.prepare("DELETE FROM wards WHERE id = ?").run(wardId);
    const orphans = people.filter((id) => !d.prepare("SELECT 1 FROM ward_members WHERE member_id = ?").get(id));
    for (const id of orphans) deleteAccount(id);
    return { accounts: orphans.length };
  })();
}

/** Deletes an organization and everything in it. The ward-wide one can't be deleted. */
export function deleteOrg(orgId: number): boolean {
  const org = getOrg(orgId);
  if (!org || org.kind === "ward") return false;
  const d = db();
  d.transaction(() => {
    for (const t of ORG_TABLES) d.prepare(`DELETE FROM ${t} WHERE org_id = ?`).run(orgId);
    d.prepare("DELETE FROM orgs WHERE id = ?").run(orgId);
  })();
  return true;
}

/** Organizations (not the ward itself) whose membership this person can set for others. */
export function managedOrgs(user: CurrentUser): Org[] {
  const groups = orgsInWard(user.ward_id).filter((o) => o.kind === "group");
  if (user.wardLeader) return groups;
  const mine = new Set(user.orgs.filter((o) => o.role === "presidency").map((o) => o.id));
  return groups.filter((o) => mine.has(o.id));
}

/** Organizations (in any of their wards, turned on) where someone is an admin or in the presidency. */
export function ledOrgsAnywhere(memberId: number): { id: number; label: string; ward: string }[] {
  return (
    db()
      .prepare(
        `SELECT o.id, CASE WHEN o.kind = 'ward' THEN w.name ELSE o.name END AS label, w.name AS ward
         FROM org_members om JOIN orgs o ON o.id = om.org_id JOIN wards w ON w.id = o.ward_id
         JOIN ward_members wm ON wm.ward_id = w.id AND wm.member_id = om.member_id
         WHERE om.member_id = ? AND om.role = 'presidency' AND o.active = 1
         ORDER BY w.name COLLATE NOCASE, o.kind = 'group', o.name COLLATE NOCASE`,
      )
      .all(memberId) as { id: number; label: string; ward: string }[]
  );
}

export interface MyOrg extends Org {
  /** "Elders Quorum", the ward's name for the ward itself, with the ward added when they're in more than one. */
  label: string;
  role: Role;
}

/**
 * The organizations someone belongs to (officially, or as a leader), in every ward
 * they're in, plus each ward itself. Turned-off organizations are left out. Ward
 * first, then organizations by name.
 */
export function myOrgs(memberId: number): MyOrg[] {
  const rows = db()
    .prepare(
      `SELECT o.id, o.ward_id, o.name, o.kind, o.hidden_features, o.active, w.name AS ward_name, COALESCE(om.role, 'member') AS role
       FROM orgs o JOIN wards w ON w.id = o.ward_id
       JOIN ward_members wm ON wm.ward_id = o.ward_id AND wm.member_id = ?
       LEFT JOIN org_members om ON om.org_id = o.id AND om.member_id = wm.member_id
       WHERE o.active = 1 AND (o.kind = 'ward' OR om.official = 1 OR om.role <> 'member')
       ORDER BY w.name COLLATE NOCASE, o.kind = 'group', o.name COLLATE NOCASE`,
    )
    .all(memberId) as (Org & { ward_name: string; role: Role })[];
  const manyWards = new Set(rows.map((r) => r.ward_id)).size > 1;
  return rows.map(({ ward_name, ...o }) => ({ ...o, label: o.kind === "ward" ? ward_name : manyWards ? `${ward_name} ${o.name}` : o.name }));
}

/** A ward's administrators (up to two), by name. */
export function wardAdmins(wardId: number): { id: number; display_name: string }[] {
  return db()
    .prepare("SELECT m.id, m.display_name FROM ward_admins a JOIN members m ON m.id = a.member_id WHERE a.ward_id = ? ORDER BY m.display_name COLLATE NOCASE")
    .all(wardId) as { id: number; display_name: string }[];
}

/** Ward settings are for its administrators and the site owner; until any are chosen, its leaders too. */
function isWardAdmin(member: { id: number; is_site_owner?: number | boolean }, wardId: number, leader: boolean): boolean {
  if (member.is_site_owner) return true;
  const admins = wardAdmins(wardId);
  return admins.length ? admins.some((a) => a.id === member.id) : leader;
}

/** Sets a ward's administrators (at most two, people in the ward). */
export function setWardAdmins(wardId: number, ids: number[]) {
  const d = db();
  const keep = [...new Set(ids)].filter((id) => d.prepare("SELECT 1 FROM ward_members WHERE ward_id = ? AND member_id = ?").get(wardId, id)).slice(0, 2);
  d.transaction(() => {
    d.prepare("DELETE FROM ward_admins WHERE ward_id = ?").run(wardId);
    for (const id of keep) d.prepare("INSERT INTO ward_admins (ward_id, member_id) VALUES (?, ?)").run(wardId, id);
  })();
  return keep;
}

/**
 * Clears a ward's messages and alerts, e.g. before going live after testing: every
 * announcement and conversation in its organizations (Messages), and everyone's
 * Reminders & alerts from them. Calendar, plans, service, lessons and people stay.
 */
export function clearWardMessages(wardId: number): { messages: number; conversations: number; alerts: number } {
  const d = db();
  const orgs = (d.prepare("SELECT id FROM orgs WHERE ward_id = ?").all(wardId) as { id: number }[]).map((o) => o.id);
  if (!orgs.length) return { messages: 0, conversations: 0, alerts: 0 };
  const inOrgs = `(${orgs.map(() => "?").join(",")})`;
  return d.transaction(() => {
    // Recipients, read marks and reply links go with them (ON DELETE CASCADE / SET NULL).
    const conversations = d.prepare(`DELETE FROM member_messages WHERE org_id IN ${inOrgs}`).run(...orgs).changes;
    const messages = d.prepare(`DELETE FROM messages WHERE org_id IN ${inOrgs}`).run(...orgs).changes;
    const alerts = d
      .prepare(`DELETE FROM notification_log WHERE org_id IN ${inOrgs} OR (org_id IS NULL AND member_id IN (SELECT member_id FROM ward_members WHERE ward_id = ?))`)
      .run(...orgs, wardId).changes;
    d.prepare(`DELETE FROM member_text_orgs WHERE org_id IN ${inOrgs}`).run(...orgs);
    d.prepare("DELETE FROM sms_member_pending WHERE member_id IN (SELECT member_id FROM ward_members WHERE ward_id = ?)").run(wardId);
    return { messages, conversations, alerts };
  })();
}

/**
 * Clears a ward's calendar: every event (with its RSVPs and repeating series) and
 * every event request in its organizations. Presidency meetings stay, without their
 * calendar entry.
 */
export function clearWardCalendar(wardId: number): { events: number } {
  const d = db();
  const orgs = (d.prepare("SELECT id FROM orgs WHERE ward_id = ?").all(wardId) as { id: number }[]).map((o) => o.id);
  if (!orgs.length) return { events: 0 };
  const inOrgs = `(${orgs.map(() => "?").join(",")})`;
  return d.transaction(() => {
    const events = d.prepare(`DELETE FROM events WHERE org_id IN ${inOrgs}`).run(...orgs).changes;
    d.prepare(`DELETE FROM event_series WHERE org_id IN ${inOrgs}`).run(...orgs);
    d.prepare(`DELETE FROM event_requests WHERE org_id IN ${inOrgs}`).run(...orgs);
    return { events };
  })();
}

/** Clears a ward's service opportunities, with their slots, sign-ups and public sign-up links. */
export function clearWardService(wardId: number): { signups: number } {
  const d = db();
  const orgs = (d.prepare("SELECT id FROM orgs WHERE ward_id = ?").all(wardId) as { id: number }[]).map((o) => o.id);
  if (!orgs.length) return { signups: 0 };
  const inOrgs = `(${orgs.map(() => "?").join(",")})`;
  return { signups: d.prepare(`DELETE FROM signups WHERE org_id IN ${inOrgs}`).run(...orgs).changes };
}
