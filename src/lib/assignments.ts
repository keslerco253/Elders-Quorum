import { DateTime } from "luxon";
import { db } from "./db";
import { withOrg } from "./org-cookie";
import { hasFeature, myOrgs } from "./orgs";
import { formatDate } from "./time";

// Presidency assignments (the todos table), and a member's "My assignments": what the
// presidency asked them to do, the lessons they're teaching and the service they signed up for.

/** How long meeting notes and finished assignments are kept before the presidency is asked to review them. */
export const REVIEW_MONTHS = 3;

export const reviewDate = (from: string) => DateTime.fromISO(from).plus({ months: REVIEW_MONTHS }).toISODate()!;

export type TodoStatus = "open" | "progress" | "done";
export const STATUS_LABELS: Record<TodoStatus, string> = { open: "Not started", progress: "In progress", done: "Done" };

export interface Todo {
  id: number;
  org_id: number;
  title: string;
  notes: string;
  due_date: string | null;
  assignee_id: number | null;
  assignee: string | null;
  status: TodoStatus;
  done: number;
  done_at: string | null;
  meeting_id: number | null;
  meeting_date: string | null;
  created_by: number | null;
  creator: string | null;
  created_at: string;
  note_count: number;
}

const TODO_SELECT = `SELECT t.id, t.org_id, t.title, t.notes, t.due_date, t.assignee_id, t.status, t.done, t.done_at, t.meeting_id, t.created_by, t.created_at,
    a.display_name AS assignee, c.display_name AS creator, mt.date AS meeting_date,
    (SELECT COUNT(*) FROM todo_notes n WHERE n.todo_id = t.id) AS note_count
  FROM todos t LEFT JOIN members a ON a.id = t.assignee_id LEFT JOIN members c ON c.id = t.created_by LEFT JOIN meetings mt ON mt.id = t.meeting_id`;

export function getTodo(id: number): Todo | undefined {
  return db().prepare(`${TODO_SELECT} WHERE t.id = ?`).get(id) as Todo | undefined;
}

export function orgTodos(orgId: number, opts: { assigneeId?: number; meetingId?: number } = {}): Todo[] {
  const where = ["t.org_id = ?"];
  const args: number[] = [orgId];
  if (opts.assigneeId) (where.push("t.assignee_id = ?"), args.push(opts.assigneeId));
  if (opts.meetingId) (where.push("t.meeting_id = ?"), args.push(opts.meetingId));
  return db()
    .prepare(`${TODO_SELECT} WHERE ${where.join(" AND ")} ORDER BY t.done, t.due_date IS NULL, t.due_date, t.id DESC LIMIT 300`)
    .all(...args) as Todo[];
}

/** Open assignments this person gave someone else, soonest due first. */
export function givenBy(memberId: number): Todo[] {
  return db()
    .prepare(`${TODO_SELECT} WHERE t.created_by = ? AND t.done = 0 AND (t.assignee_id IS NULL OR t.assignee_id <> ?) ORDER BY t.due_date IS NULL, t.due_date, t.id DESC LIMIT 50`)
    .all(memberId, memberId) as Todo[];
}

/** Whether this person is in the organization's presidency. */
export function isPresidencyOf(memberId: number, orgId: number): boolean {
  return !!db().prepare("SELECT 1 FROM org_members WHERE org_id = ? AND member_id = ? AND role = 'presidency'").get(orgId, memberId);
}

/** Sets an assignment's status (done also sets when it's up for review). */
export function setTodoStatus(id: number, status: TodoStatus, today: string) {
  const done = status === "done" ? 1 : 0;
  db()
    .prepare(
      `UPDATE todos SET status = ?, done = ?, done_at = CASE WHEN ? = 1 THEN coalesce(done_at, datetime('now')) END,
         review_at = CASE WHEN ? = 1 THEN ? END WHERE id = ?`,
    )
    .run(status, done, done, done, reviewDate(today), id);
}

export interface TodoNote {
  id: number;
  author_id: number | null;
  author: string | null;
  body: string;
  private: number;
  created_at: string;
}

/** Progress notes, oldest first. Notes marked presidency only are left out for others. */
export function todoNotes(todoId: number, includePrivate: boolean): TodoNote[] {
  return db()
    .prepare(
      `SELECT n.id, n.author_id, m.display_name AS author, n.body, n.private, n.created_at FROM todo_notes n LEFT JOIN members m ON m.id = n.author_id
       WHERE n.todo_id = ? ${includePrivate ? "" : "AND n.private = 0"} ORDER BY n.id`,
    )
    .all(todoId) as TodoNote[];
}

export type MyItemKind = "todo" | "teach" | "serve";

/** One line in My assignments. */
export interface MyItem {
  kind: MyItemKind;
  key: string;
  title: string;
  /** Due date, lesson date or service date (null when there's none). */
  date: string | null;
  orgId: number;
  orgLabel: string;
  href: string;
  /** "Due Thu, Oct 30", "Sun, Nov 2", or for service the slot. */
  detail: string;
  /** Something they should do: confirm teaching, an overdue assignment. */
  flag?: { tone: "warn" | "danger" | "info"; text: string };
  done: boolean;
}

/**
 * Everything on a member's plate in every organization they're in: assignments from a
 * presidency, lessons they teach and service they signed up for. `past` gives the
 * finished ones (and dates gone by) instead, newest first.
 */
export function myAssignments(memberId: number, today: string, opts: { past?: boolean; orgId?: number } = {}): MyItem[] {
  const orgs = myOrgs(memberId);
  const label = new Map(orgs.map((o) => [o.id, o.label]));
  const one = opts.orgId;
  const inOrgs = (o: { id: number }) => !one || o.id === one;
  const items: MyItem[] = [];
  const past = !!opts.past;
  const link = (href: string, orgId: number) => withOrg(href, orgId);

  const todoOrgs = new Set(orgs.filter((o) => hasFeature(o, "todos") && inOrgs(o)).map((o) => o.id));
  const todos = db()
    .prepare(`${TODO_SELECT} WHERE t.assignee_id = ? AND t.done = ? ${past ? "AND t.done_at > datetime('now', '-6 months')" : ""} ORDER BY t.due_date`)
    .all(memberId, past ? 1 : 0) as Todo[];
  for (const t of todos) {
    if (!todoOrgs.has(t.org_id)) continue;
    const overdue = !t.done && !!t.due_date && t.due_date < today;
    items.push({
      kind: "todo",
      key: `todo:${t.id}`,
      title: t.title,
      date: t.due_date,
      orgId: t.org_id,
      orgLabel: label.get(t.org_id) ?? "",
      href: link(`/assignments/${t.id}`, t.org_id),
      detail: t.done ? `Done ${t.done_at ? formatDate(t.done_at.slice(0, 10), "short") : ""}` : t.due_date ? `Due ${formatDate(t.due_date, "short")}` : "No due date",
      flag: overdue ? { tone: "danger", text: "Overdue" } : t.due_date === today ? { tone: "warn", text: "Due today" } : t.status === "progress" ? { tone: "info", text: "In progress" } : undefined,
      done: !!t.done,
    });
  }

  const lessonOrgs = new Set(orgs.filter((o) => hasFeature(o, "lessons") && inOrgs(o)).map((o) => o.id));
  const lessons = db()
    .prepare(
      `SELECT id, org_id, date, title, teacher_confirmed_at FROM lessons WHERE teacher_id = ? AND kind = 'talk' AND date ${past ? "<" : ">="} ?
       ORDER BY date ${past ? "DESC LIMIT 20" : ""}`,
    )
    .all(memberId, today) as { id: number; org_id: number; date: string; title: string; teacher_confirmed_at: string | null }[];
  for (const l of lessons) {
    if (!lessonOrgs.has(l.org_id)) continue;
    items.push({
      kind: "teach",
      key: `teach:${l.id}`,
      title: `Teach${l.title ? `: ${l.title}` : ` ${label.get(l.org_id) ?? ""}`}`,
      date: l.date,
      orgId: l.org_id,
      orgLabel: label.get(l.org_id) ?? "",
      href: link(`/lessons/${l.id}`, l.org_id),
      detail: formatDate(l.date, "short"),
      flag: !past && !l.teacher_confirmed_at ? { tone: "warn", text: "Please confirm" } : undefined,
      done: past,
    });
  }

  const serveOrgs = new Set(orgs.filter((o) => hasFeature(o, "signups") && inOrgs(o)).map((o) => o.id));
  const serving = db()
    .prepare(
      `SELECT s.id, s.org_id, s.title, s.date, group_concat(sl.label, ', ') AS slots FROM signup_entries e
       JOIN signup_slots sl ON sl.id = e.slot_id JOIN signups s ON s.id = sl.signup_id
       WHERE e.member_id = ? AND ${past ? "s.date < ?" : "(s.date >= ? OR s.date IS NULL)"}
       GROUP BY s.id ORDER BY s.date ${past ? "DESC LIMIT 20" : ""}`,
    )
    .all(memberId, today) as { id: number; org_id: number; title: string; date: string | null; slots: string }[];
  for (const s of serving) {
    if (!serveOrgs.has(s.org_id)) continue;
    items.push({
      kind: "serve",
      key: `serve:${s.id}`,
      title: s.title,
      date: s.date,
      orgId: s.org_id,
      orgLabel: label.get(s.org_id) ?? "",
      href: link(`/signups/${s.id}`, s.org_id),
      detail: [s.date && formatDate(s.date, "short"), s.slots].filter(Boolean).join(" · "),
      done: past,
    });
  }

  // Soonest first (no date last); past ones newest first.
  const sortKey = (i: MyItem) => i.date ?? (past ? "0000" : "9999");
  return items.sort((a, b) => (past ? sortKey(b).localeCompare(sortKey(a)) : sortKey(a).localeCompare(sortKey(b))));
}

/** For the home page: anything overdue, needing an answer, or in the next two weeks. */
export function soonAssignments(memberId: number, today: string): MyItem[] {
  const until = DateTime.fromISO(today).plus({ days: 14 }).toISODate()!;
  return myAssignments(memberId, today).filter((i) => i.flag?.tone === "danger" || i.flag?.text === "Please confirm" || (i.date !== null && i.date <= until) || (i.kind === "todo" && !i.date));
}

export const KIND_ICONS: Record<MyItemKind, string> = { todo: "📋", teach: "📖", serve: "🛠️" };
