import { DateTime } from "luxon";
import { db } from "./db";
import { reviewDate } from "./assignments";
import { localInputToUtc } from "./time";
import { reminderSettings } from "./reminder-settings";
import { getOrg } from "./orgs";
import { CALLINGS, callingLabel, isCalling, leadersWord } from "./types";

// Presidency meetings: notes, who came, and the agenda. Agenda items wait (meeting_id
// NULL) until a meeting where they were discussed is finished; the rest carry over.
// Other meetings ("invited") are scheduled by the presidency for the people they
// invite; their agenda belongs to them from the start.

export interface Meeting {
  id: number;
  org_id: number;
  date: string;
  /** Start time (HH:MM) when it's scheduled. */
  time: string | null;
  /** Its presidency-only event on the calendar. */
  event_id: number | null;
  title: string;
  attendees: string;
  notes: string;
  held_at: string | null;
  review_at: string | null;
  created_by: number | null;
  updated_at: string;
  opening_prayer: string;
  spiritual_thought: string;
  closing_prayer: string;
  /** The presidency's own meeting, or one for the people invited. */
  kind: MeetingKind;
  location: string;
}

export type MeetingKind = "presidency" | "invited";

/** Who gave the prayers and the thought: kept as names on the meeting's record. */
export const MEETING_ROLES = [
  ["opening_prayer", "Opening prayer"],
  ["spiritual_thought", "Spiritual thought"],
  ["closing_prayer", "Closing prayer"],
] as const;
export type MeetingRole = (typeof MEETING_ROLES)[number][0];
export const isMeetingRole = (v: unknown): v is MeetingRole => MEETING_ROLES.some(([k]) => k === v);

export function setMeetingRole(orgId: number, meetingId: number, role: MeetingRole, name: string) {
  db().prepare(`UPDATE meetings SET ${role} = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?`).run(name.trim().slice(0, 100), meetingId, orgId);
}

/** "Opening prayer: Hyrum · Spiritual thought: Mark …", for the list of meetings. */
export function meetingRolesText(m: Pick<Meeting, MeetingRole>): string {
  return MEETING_ROLES.filter(([k]) => m[k])
    .map(([k, label]) => `${label}: ${m[k]}`)
    .join(" · ");
}

/** "Presidency meeting" ("Bishopric meeting" for the ward). */
export function meetingName(orgId: number, m?: Pick<Meeting, "title">): string {
  const org = getOrg(orgId);
  const word = org ? leadersWord(org) : "presidency";
  return m?.title || `${word[0].toUpperCase()}${word.slice(1)} meeting`;
}

export function getMeeting(orgId: number, id: number): Meeting | undefined {
  return db().prepare("SELECT * FROM meetings WHERE id = ? AND org_id = ?").get(id, orgId) as Meeting | undefined;
}

export type ListedMeeting = Meeting & { item_count: number; todo_count: number; invited_count: number; coming_count: number };

export function orgMeetings(orgId: number): ListedMeeting[] {
  return db()
    .prepare(
      `SELECT m.*, (SELECT COUNT(*) FROM agenda_items a WHERE a.meeting_id = m.id) AS item_count, (SELECT COUNT(*) FROM todos t WHERE t.meeting_id = m.id) AS todo_count,
         (SELECT COUNT(*) FROM meeting_invitees i WHERE i.meeting_id = m.id) AS invited_count,
         (SELECT COUNT(*) FROM meeting_invitees i WHERE i.meeting_id = m.id AND i.response = 'yes') AS coming_count
       FROM meetings m WHERE m.org_id = ? ORDER BY m.date DESC, m.id DESC LIMIT 100`,
    )
    .all(orgId) as ListedMeeting[];
}

export function createMeeting(
  orgId: number,
  date: string,
  title: string,
  createdBy: number,
  opts: { time?: string | null; tz?: string; kind?: MeetingKind; location?: string } = {},
): number {
  const id = Number(
    db()
      .prepare("INSERT INTO meetings (org_id, date, time, title, created_by, kind, location) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(orgId, date, opts.time ?? null, title, createdBy, opts.kind ?? "presidency", (opts.location ?? "").trim().slice(0, 200)).lastInsertRowid,
  );
  if (opts.time && opts.tz) syncMeetingEvent(orgId, id, opts.tz, createdBy);
  return id;
}

/**
 * Keeps a scheduled meeting's calendar event in step: a presidency-only event (on
 * the presidency's Coming up list, with a reminder an hour before) at its date and
 * time, or none when it has no time. For an invited meeting the people invited see
 * it too (on their calendar and Coming up, with the same reminder).
 */
export function syncMeetingEvent(orgId: number, meetingId: number, tz: string, by: number | null) {
  const d = db();
  const m = getMeeting(orgId, meetingId);
  if (!m) return;
  const starts = m.time ? localInputToUtc(`${m.date}T${m.time}`, tz) : null;
  if (!starts) {
    if (m.event_id) d.prepare("DELETE FROM events WHERE id = ? AND org_id = ?").run(m.event_id, orgId);
    d.prepare("UPDATE meetings SET event_id = NULL WHERE id = ?").run(m.id);
    return;
  }
  const ends = DateTime.fromISO(starts).plus({ hours: 1 }).toUTC().toISO({ suppressMilliseconds: true })!;
  const title = meetingName(orgId, m);
  const description = m.kind === "invited" ? "For the people invited. Open it for the agenda, and to say whether you can come." : "The agenda and notes are under Admin → Presidency meetings.";
  const exists = m.event_id && d.prepare("SELECT 1 FROM events WHERE id = ? AND org_id = ?").get(m.event_id, orgId);
  if (exists)
    d.prepare("UPDATE events SET title = ?, location = ?, starts_at = ?, ends_at = ?, reminder_minutes = ? WHERE id = ?").run(title, m.location, starts, ends, reminderSettings(orgId).meetingMinutes || null, m.event_id);
  else {
    const id = d
      .prepare("INSERT INTO events (org_id, title, description, location, starts_at, ends_at, presidency_only, reminder_minutes, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)")
      .run(orgId, title, description, m.location, starts, ends, reminderSettings(orgId).meetingMinutes || null, by).lastInsertRowid;
    d.prepare("UPDATE meetings SET event_id = ? WHERE id = ?").run(Number(id), m.id);
  }
}

/** Deletes a meeting (its notes and filed agenda) and its calendar event; assignments stay. */
export function deleteMeetingRecord(orgId: number, meetingId: number) {
  const d = db();
  const m = getMeeting(orgId, meetingId);
  if (!m) return;
  if (m.event_id) d.prepare("DELETE FROM events WHERE id = ? AND org_id = ?").run(m.event_id, orgId);
  d.prepare("DELETE FROM meetings WHERE id = ?").run(m.id);
}

/** The meeting a calendar event is for, if any. */
export function meetingForEvent(eventId: number): Meeting | undefined {
  return db().prepare("SELECT * FROM meetings WHERE event_id = ?").get(eventId) as Meeting | undefined;
}

/**
 * Who can be ticked as there: the presidency and anyone with a calling (secretaries, a
 * high councilor), plus a box for each calling no one holds yet (its title), so the
 * assistant secretary or high councilor can be ticked before they're set up.
 */
export function attendeeChoices(orgId: number): { id: number; name: string; calling: string | null }[] {
  const org = getOrg(orgId);
  const rows = db()
    .prepare(
      `SELECT m.id, m.display_name AS name, om.calling, om.role FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
       WHERE m.status = 'active' AND (om.role = 'presidency' OR om.calling IS NOT NULL) ORDER BY m.display_name COLLATE NOCASE`,
    )
    .all(orgId) as { id: number; name: string; calling: string | null; role: string }[];
  const order = ["bishop", "president", "first_counselor", "second_counselor", "executive_secretary", "ward_clerk", "secretary", "assistant_secretary", "stake_high_council"];
  // Callings no one holds: a box with the calling's title (negative ids: not a person).
  const open = org ? CALLINGS[org.kind].filter((c) => !rows.some((r) => r.calling === c)) : [];
  const all = [...rows, ...open.map((c, i) => ({ id: -(i + 1), name: callingLabel(c, org!), calling: c, role: "open" }))];
  // By calling; presidency members without one come after the counselors.
  const rank = (r: { calling: string | null; role: string }) => (r.calling && order.includes(r.calling) ? order.indexOf(r.calling) : r.role === "presidency" ? 3.5 : order.length);
  return all
    .sort((a, b) => rank(a) - rank(b))
    .map((r) => ({ id: r.id, name: r.name, calling: r.role === "open" ? null : org && isCalling(r.calling) ? callingLabel(r.calling, org) : null }));
}

/**
 * An agenda item's wording and notes. New notes taken in the meeting count it as
 * discussed; notes written ahead of time (beforehand), or saved unchanged, don't.
 */
export function saveAgendaNotes(orgId: number, itemId: number, notes: string, opts: { body?: string; beforehand?: boolean } = {}) {
  const text = notes.trim().slice(0, 4000);
  const body = opts.body?.trim().slice(0, 2000);
  const d = db();
  if (body) d.prepare("UPDATE agenda_items SET body = ? WHERE id = ? AND org_id = ?").run(body, itemId, orgId);
  // Only new notes taken in the meeting tick it (not rewording an item, or notes written beforehand).
  if (opts.beforehand) d.prepare("UPDATE agenda_items SET notes = ? WHERE id = ? AND org_id = ?").run(text, itemId, orgId);
  else d.prepare("UPDATE agenda_items SET discussed = CASE WHEN ? <> '' AND ? <> notes THEN 1 ELSE discussed END, notes = ? WHERE id = ? AND org_id = ?").run(text, text, text, itemId, orgId);
}

export interface AgendaItem {
  id: number;
  meeting_id: number | null;
  body: string;
  /** Notes on it from the meeting. */
  notes: string;
  source: string;
  link: string | null;
  discussed: number;
  added_by: number | null;
  adder: string | null;
  created_at: string;
}

/** Items waiting for the next meeting, in the order the presidency put them (new ones last). */
export function pendingAgenda(orgId: number): AgendaItem[] {
  return db()
    .prepare(`SELECT a.*, m.display_name AS adder FROM agenda_items a LEFT JOIN members m ON m.id = a.added_by WHERE a.org_id = ? AND a.meeting_id IS NULL ORDER BY a.position, a.id`)
    .all(orgId) as AgendaItem[];
}

export function meetingAgenda(meetingId: number): AgendaItem[] {
  return db().prepare(`SELECT a.*, m.display_name AS adder FROM agenda_items a LEFT JOIN members m ON m.id = a.added_by WHERE a.meeting_id = ? ORDER BY a.position, a.id`).all(meetingId) as AgendaItem[];
}

/** Moves an agenda item up (-1) or down (1) one place, or to the top, within its agenda. */
export function moveAgendaItem(orgId: number, itemId: number, dir: -1 | 1 | "top") {
  const item = db().prepare("SELECT meeting_id FROM agenda_items WHERE id = ? AND org_id = ?").get(itemId, orgId) as { meeting_id: number | null } | undefined;
  if (!item) return;
  const ids = (item.meeting_id ? meetingAgenda(item.meeting_id) : pendingAgenda(orgId)).map((a) => a.id);
  const i = ids.indexOf(itemId);
  if (i < 0) return;
  if (dir === "top") ids.unshift(...ids.splice(i, 1));
  else {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const d = db();
  const set = d.prepare("UPDATE agenda_items SET position = ? WHERE id = ?");
  d.transaction(() => ids.forEach((id, n) => set.run(n + 1, id)))();
}

/** Puts something on the next presidency meeting's agenda. */
export function addAgendaItem(orgId: number, body: string, opts: { source?: string; link?: string | null; addedBy: number; meetingId?: number }): number {
  // An invited meeting's agenda is its own; the presidency's waits for the next meeting.
  const meetingId = opts.meetingId ?? null;
  return Number(
    db()
      .prepare(
        `INSERT INTO agenda_items (org_id, body, source, link, added_by, meeting_id, position)
         VALUES (?, ?, ?, ?, ?, ?, (SELECT coalesce(max(position), 0) + 1 FROM agenda_items WHERE org_id = ? AND meeting_id IS ?))`,
      )
      .run(orgId, body.trim().slice(0, 2000), (opts.source ?? "").slice(0, 200), opts.link ?? null, opts.addedBy, meetingId, orgId, meetingId).lastInsertRowid,
  );
}

/**
 * Finishes a meeting: items discussed join it (and leave the agenda); the others wait
 * for the next one. Its notes come up for review in a few months.
 */
export function finishMeeting(orgId: number, meetingId: number, today: string) {
  const d = db();
  d.transaction(() => {
    const m = getMeeting(orgId, meetingId);
    if (m?.kind !== "invited") d.prepare("UPDATE agenda_items SET meeting_id = ? WHERE org_id = ? AND meeting_id IS NULL AND discussed = 1").run(meetingId, orgId);
    d.prepare("UPDATE meetings SET held_at = coalesce(held_at, datetime('now')), review_at = ?, updated_at = datetime('now') WHERE id = ?").run(reviewDate(m && m.date > today ? m.date : today), meetingId);
  })();
}

export interface ReviewRecord {
  kind: "meeting" | "todo" | "agenda";
  id: number;
  title: string;
  date: string;
  href: string;
}

/**
 * Records whose review date has come: meetings (with their notes and agenda), finished
 * assignments, and agenda items that have waited more than a few months. Nothing is
 * deleted on its own; the presidency keeps or deletes each one.
 */
export function recordsToReview(orgId: number, today: string): ReviewRecord[] {
  const d = db();
  const meetings = d.prepare("SELECT id, date, title FROM meetings WHERE org_id = ? AND review_at IS NOT NULL AND review_at <= ? ORDER BY date").all(orgId, today) as { id: number; date: string; title: string }[];
  const todos = d.prepare("SELECT id, title, coalesce(substr(done_at, 1, 10), due_date, substr(created_at, 1, 10)) AS date FROM todos WHERE org_id = ? AND done = 1 AND review_at IS NOT NULL AND review_at <= ? ORDER BY done_at").all(orgId, today) as {
    id: number;
    title: string;
    date: string;
  }[];
  const stale = DateTime.fromISO(today).minus({ months: 3 }).toISODate()!;
  const agenda = d
    .prepare("SELECT id, body, substr(created_at, 1, 10) AS date FROM agenda_items WHERE org_id = ? AND meeting_id IS NULL AND (review_at IS NULL AND substr(created_at, 1, 10) <= ? OR review_at <= ?) ORDER BY id")
    .all(orgId, stale, today) as { id: number; body: string; date: string }[];
  return [
    ...meetings.map((m) => ({ kind: "meeting" as const, id: m.id, title: m.title || "Presidency meeting", date: m.date, href: `/admin/meetings/${m.id}` })),
    ...todos.map((t) => ({ kind: "todo" as const, id: t.id, title: t.title, date: t.date, href: `/assignments/${t.id}` })),
    ...agenda.map((a) => ({ kind: "agenda" as const, id: a.id, title: a.body.length > 90 ? `${a.body.slice(0, 87)}…` : a.body, date: a.date, href: "/admin/meetings#agenda" })),
  ];
}

/** Keeps a record for a few more months, or deletes it. */
export function reviewRecord(orgId: number, kind: ReviewRecord["kind"], id: number, keep: boolean, today: string) {
  const d = db();
  const table = kind === "meeting" ? "meetings" : kind === "todo" ? "todos" : "agenda_items";
  if (keep) d.prepare(`UPDATE ${table} SET review_at = ? WHERE id = ? AND org_id = ?`).run(reviewDate(today), id, orgId);
  else if (kind === "meeting") deleteMeetingRecord(orgId, id);
  else d.prepare(`DELETE FROM ${table} WHERE id = ? AND org_id = ?`).run(id, orgId);
}

// Video meetings: the presidency's own link (a Zoom personal meeting room, a recurring
// meeting, Google Meet or Teams). Only the presidency sees it.

/** Accepts a Zoom, Google Meet or Teams link (https only); null if it isn't one. */
export function cleanVideoLink(raw: string): string | null {
  const v = raw.trim();
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "https:") return null;
    return /(^|\.)(zoom\.us|zoomgov\.com|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)$/i.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** "Zoom", "Google Meet", "Teams" or "video". */
export function videoKind(link: string): string {
  const host = new URL(link).hostname;
  return /zoom/.test(host) ? "Zoom" : /meet\.google/.test(host) ? "Google Meet" : /teams/.test(host) ? "Teams" : "video";
}

export function videoLink(orgId: number): string | null {
  return (db().prepare("SELECT video_link FROM orgs WHERE id = ?").get(orgId) as { video_link: string | null } | undefined)?.video_link ?? null;
}

export function setVideoLink(orgId: number, link: string | null) {
  db().prepare("UPDATE orgs SET video_link = ? WHERE id = ?").run(link, orgId);
}

// Invited meetings: who's invited, and whether they'll come.

export interface Invitee {
  member_id: number;
  display_name: string;
  response: "yes" | "no" | null;
}

export function meetingInvitees(meetingId: number): Invitee[] {
  return db()
    .prepare(
      `SELECT i.member_id, m.display_name, i.response FROM meeting_invitees i JOIN members m ON m.id = i.member_id
       WHERE i.meeting_id = ? ORDER BY m.display_name COLLATE NOCASE`,
    )
    .all(meetingId) as Invitee[];
}

/** Invites people; returns the ones newly invited (to tell them). */
export function inviteToMeeting(meetingId: number, memberIds: number[]): number[] {
  const ins = db().prepare("INSERT OR IGNORE INTO meeting_invitees (meeting_id, member_id) VALUES (?, ?)");
  return [...new Set(memberIds)].filter((id) => ins.run(meetingId, id).changes > 0);
}

export function uninviteFromMeeting(meetingId: number, memberId: number) {
  db().prepare("DELETE FROM meeting_invitees WHERE meeting_id = ? AND member_id = ?").run(meetingId, memberId);
}

export function respondToMeeting(meetingId: number, memberId: number, response: "yes" | "no"): boolean {
  return (
    db().prepare("UPDATE meeting_invitees SET response = ?, responded_at = datetime('now') WHERE meeting_id = ? AND member_id = ?").run(response, meetingId, memberId).changes > 0
  );
}

/** An invited meeting, for someone invited to it. */
export function invitedMeeting(memberId: number, meetingId: number): (Meeting & { response: Invitee["response"] }) | undefined {
  return db()
    .prepare("SELECT mt.*, i.response FROM meetings mt JOIN meeting_invitees i ON i.meeting_id = mt.id AND i.member_id = ? WHERE mt.id = ? AND mt.kind = 'invited'")
    .get(memberId, meetingId) as (Meeting & { response: Invitee["response"] }) | undefined;
}

/**
 * Who can be invited at once: the presidency, each calling (the presidency's, and
 * callings the organization added) with the people holding it, and everyone.
 */
export function inviteGroups(orgId: number): { key: string; label: string; ids: number[] }[] {
  const org = getOrg(orgId);
  if (!org) return [];
  const d = db();
  const roster = d
    .prepare(
      `SELECT m.id, om.role, om.calling FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
       WHERE m.status = 'active' AND (om.official = 1 OR om.role <> 'member')`,
    )
    .all(orgId) as { id: number; role: string; calling: string | null }[];
  const groups = [{ key: "presidency", label: `The ${leadersWord(org)}`, ids: roster.filter((r) => r.role === "presidency").map((r) => r.id) }];
  for (const c of CALLINGS[org.kind]) {
    const ids = roster.filter((r) => r.calling === c).map((r) => r.id);
    if (ids.length) groups.push({ key: `calling:${c}`, label: callingLabel(c, org), ids });
  }
  const added = d
    .prepare("SELECT c.id, c.name, mc.member_id FROM org_callings c JOIN member_callings mc ON mc.calling_id = c.id WHERE c.org_id = ? ORDER BY c.name COLLATE NOCASE")
    .all(orgId) as { id: number; name: string; member_id: number }[];
  for (const c of [...new Map(added.map((a) => [a.id, a.name]))]) {
    const ids = added.filter((a) => a.id === c[0] && roster.some((r) => r.id === a.member_id)).map((a) => a.member_id);
    if (ids.length) groups.push({ key: `added:${c[0]}`, label: c[1], ids });
  }
  groups.push({ key: "everyone", label: `Everyone in ${org.kind === "ward" ? "the ward" : org.name}`, ids: roster.map((r) => r.id) });
  return groups;
}
