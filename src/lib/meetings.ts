import { DateTime } from "luxon";
import { db } from "./db";
import { reviewDate } from "./assignments";

// Presidency meetings: notes, who came, and the agenda. Agenda items wait (meeting_id
// NULL) until a meeting where they were discussed is finished; the rest carry over.

export interface Meeting {
  id: number;
  org_id: number;
  date: string;
  title: string;
  attendees: string;
  notes: string;
  held_at: string | null;
  review_at: string | null;
  created_by: number | null;
  updated_at: string;
}

/** The headings a new meeting's notes start with. */
export const NOTES_TEMPLATE = ["Ministering", "Members needing help", "Calendar", "Assignments review", "Other"].map((h) => `## ${h}\n\n`).join("");

export function getMeeting(orgId: number, id: number): Meeting | undefined {
  return db().prepare("SELECT * FROM meetings WHERE id = ? AND org_id = ?").get(id, orgId) as Meeting | undefined;
}

export function orgMeetings(orgId: number): (Meeting & { item_count: number; todo_count: number })[] {
  return db()
    .prepare(
      `SELECT m.*, (SELECT COUNT(*) FROM agenda_items a WHERE a.meeting_id = m.id) AS item_count, (SELECT COUNT(*) FROM todos t WHERE t.meeting_id = m.id) AS todo_count
       FROM meetings m WHERE m.org_id = ? ORDER BY m.date DESC, m.id DESC LIMIT 100`,
    )
    .all(orgId) as (Meeting & { item_count: number; todo_count: number })[];
}

export function createMeeting(orgId: number, date: string, title: string, createdBy: number): number {
  return Number(db().prepare("INSERT INTO meetings (org_id, date, title, notes, created_by) VALUES (?, ?, ?, ?, ?)").run(orgId, date, title, NOTES_TEMPLATE, createdBy).lastInsertRowid);
}

export interface AgendaItem {
  id: number;
  meeting_id: number | null;
  body: string;
  source: string;
  link: string | null;
  discussed: number;
  added_by: number | null;
  adder: string | null;
  created_at: string;
}

/** Items waiting for the next meeting, oldest first. */
export function pendingAgenda(orgId: number): AgendaItem[] {
  return db()
    .prepare(`SELECT a.*, m.display_name AS adder FROM agenda_items a LEFT JOIN members m ON m.id = a.added_by WHERE a.org_id = ? AND a.meeting_id IS NULL ORDER BY a.id`)
    .all(orgId) as AgendaItem[];
}

export function meetingAgenda(meetingId: number): AgendaItem[] {
  return db().prepare(`SELECT a.*, m.display_name AS adder FROM agenda_items a LEFT JOIN members m ON m.id = a.added_by WHERE a.meeting_id = ? ORDER BY a.id`).all(meetingId) as AgendaItem[];
}

/** Puts something on the next presidency meeting's agenda. */
export function addAgendaItem(orgId: number, body: string, opts: { source?: string; link?: string | null; addedBy: number }): number {
  return Number(
    db()
      .prepare("INSERT INTO agenda_items (org_id, body, source, link, added_by) VALUES (?, ?, ?, ?, ?)")
      .run(orgId, body.trim().slice(0, 2000), (opts.source ?? "").slice(0, 200), opts.link ?? null, opts.addedBy).lastInsertRowid,
  );
}

/**
 * Finishes a meeting: items discussed join it (and leave the agenda); the others wait
 * for the next one. Its notes come up for review in a few months.
 */
export function finishMeeting(orgId: number, meetingId: number, today: string) {
  const d = db();
  d.transaction(() => {
    d.prepare("UPDATE agenda_items SET meeting_id = ? WHERE org_id = ? AND meeting_id IS NULL AND discussed = 1").run(meetingId, orgId);
    const m = getMeeting(orgId, meetingId);
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
  else d.prepare(`DELETE FROM ${table} WHERE id = ? AND org_id = ?`).run(id, orgId);
}
