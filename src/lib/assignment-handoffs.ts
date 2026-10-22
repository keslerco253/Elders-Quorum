import { db } from "./db";
import { getTodo, isPresidencyOf, type Todo } from "./assignments";
import { orgPresidency, orgRoster } from "./orgs";

// Handing an assignment to someone else: a presidency member asks one person, or the
// whole presidency, to take it; whoever says yes first becomes the person assigned.
// And the person assigned saying they can't do it, which hands it back to the presidency.

export interface Handoff {
  id: number;
  todo_id: number;
  from_id: number | null;
  from_name: string | null;
  /** Null when the whole presidency was asked. */
  to_id: number | null;
  to_name: string | null;
  note: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
}

const SELECT = `SELECT h.id, h.todo_id, h.from_id, f.display_name AS from_name, h.to_id, t.display_name AS to_name, h.note, h.status, h.created_at
  FROM todo_handoffs h LEFT JOIN members f ON f.id = h.from_id LEFT JOIN members t ON t.id = h.to_id`;

export function getHandoff(id: number): Handoff | undefined {
  return db().prepare(`${SELECT} WHERE h.id = ?`).get(id) as Handoff | undefined;
}

/** The unanswered ask on an assignment, if there is one. */
export function pendingHandoff(todoId: number): Handoff | undefined {
  return db().prepare(`${SELECT} WHERE h.todo_id = ? AND h.status = 'pending' ORDER BY h.id DESC LIMIT 1`).get(todoId) as Handoff | undefined;
}

/** Whether this person can answer an ask: the one asked, or (for the whole presidency) anyone in it except whoever asked and whoever has it. */
export function canAnswer(h: Handoff, t: Todo, memberId: number): boolean {
  if (h.status !== "pending") return false;
  if (h.to_id) return h.to_id === memberId;
  if (memberId === h.from_id || memberId === t.assignee_id || !isPresidencyOf(memberId, t.org_id)) return false;
  return !db().prepare("SELECT 1 FROM todo_handoff_declines WHERE handoff_id = ? AND member_id = ?").get(h.id, memberId);
}

/** Asks someone (toId), or the whole presidency (null), to take an assignment. Replaces an unanswered ask. */
export function askToTake(todoId: number, fromId: number, toId: number | null, note: string): { error: string } | { id: number } {
  const t = getTodo(todoId);
  if (!t) return { error: "That assignment no longer exists." };
  if (!isPresidencyOf(fromId, t.org_id)) return { error: "Only the presidency can hand off an assignment." };
  if (t.done) return { error: "That assignment is already done." };
  if (toId !== null) {
    if (toId === t.assignee_id) return { error: "That's who has it now. Choose someone else." };
    if (toId === fromId) return { error: "To take it yourself, use Edit and assign it to yourself." };
    if (!orgRoster(t.org_id).some((p) => p.id === toId)) return { error: "Choose someone in the organization." };
  } else if (!orgPresidency(t.org_id).some((p) => p.id !== fromId && p.id !== t.assignee_id)) return { error: "There's no one else in the presidency to ask." };
  const d = db();
  return d.transaction(() => {
    d.prepare("UPDATE todo_handoffs SET status = 'cancelled', decided_at = datetime('now') WHERE todo_id = ? AND status = 'pending'").run(todoId);
    return { id: Number(d.prepare("INSERT INTO todo_handoffs (todo_id, from_id, to_id, note) VALUES (?, ?, ?, ?)").run(todoId, fromId, toId, note.trim().slice(0, 500)).lastInsertRowid) };
  })();
}

/**
 * Takes the assignment (it's now theirs) or says no. When the whole presidency was
 * asked, it's declined once everyone who could take it has said no. Returns what
 * happened, or null if they can't answer it.
 */
export function answerHandoff(id: number, memberId: number, accept: boolean): { handoff: Handoff; todo: Todo; previousAssignee: number | null; allDeclined: boolean } | null {
  const h = getHandoff(id);
  const t = h && getTodo(h.todo_id);
  if (!h || !t || !canAnswer(h, t, memberId)) return null;
  const d = db();
  let allDeclined = false;
  d.transaction(() => {
    if (accept) {
      d.prepare("UPDATE todos SET assignee_id = ?, accept_status = 'accepted' WHERE id = ?").run(memberId, t.id);
      d.prepare("UPDATE todo_handoffs SET status = 'accepted', taken_by = ?, decided_at = datetime('now') WHERE id = ?").run(memberId, id);
    } else if (h.to_id) {
      d.prepare("UPDATE todo_handoffs SET status = 'declined', decided_at = datetime('now') WHERE id = ?").run(id);
      allDeclined = true;
    } else {
      d.prepare("INSERT OR IGNORE INTO todo_handoff_declines (handoff_id, member_id) VALUES (?, ?)").run(id, memberId);
      const left = orgPresidency(t.org_id).filter((p) => canAnswer(h, t, p.id));
      if (!left.length) {
        d.prepare("UPDATE todo_handoffs SET status = 'declined', decided_at = datetime('now') WHERE id = ?").run(id);
        allDeclined = true;
      }
    }
  })();
  return { handoff: h, todo: t, previousAssignee: t.assignee_id, allDeclined };
}

/** Withdraws an unanswered ask (whoever asked). */
export function cancelHandoff(id: number, memberId: number): boolean {
  return db().prepare("UPDATE todo_handoffs SET status = 'cancelled', decided_at = datetime('now') WHERE id = ? AND from_id = ? AND status = 'pending'").run(id, memberId).changes > 0;
}

export interface HandoffAsk {
  id: number;
  todo_id: number;
  org_id: number;
  title: string;
  from_name: string | null;
  whole: boolean;
}

/** Asks waiting on this person's answer (for their home page). */
export function handoffsWaitingOn(memberId: number): HandoffAsk[] {
  const rows = db()
    .prepare(
      `SELECT h.id, h.todo_id, h.to_id, t.org_id, t.title, f.display_name AS from_name FROM todo_handoffs h
       JOIN todos t ON t.id = h.todo_id LEFT JOIN members f ON f.id = h.from_id
       WHERE h.status = 'pending' AND t.done = 0 AND (h.to_id = ? OR (h.to_id IS NULL AND EXISTS (SELECT 1 FROM org_members om WHERE om.org_id = t.org_id AND om.member_id = ? AND om.role = 'presidency')))
       ORDER BY h.id`,
    )
    .all(memberId, memberId) as (HandoffAsk & { to_id: number | null })[];
  return rows
    .filter((r) => {
      const h = getHandoff(r.id);
      const t = getTodo(r.todo_id);
      return !!h && !!t && canAnswer(h, t, memberId);
    })
    .map(({ to_id, ...r }) => ({ ...r, whole: to_id === null }));
}

/**
 * The person assigned can't do it: it goes back to the presidency unassigned, with
 * their note (if any) on it. Returns the assignment as it was, or null if it isn't theirs.
 */
export function unableToDo(todoId: number, memberId: number, note: string, what = "Unable to do this assignment"): Todo | null {
  const t = getTodo(todoId);
  if (!t || t.assignee_id !== memberId || t.done) return null;
  const d = db();
  const body = `${what}${note.trim() ? `: ${note.trim().slice(0, 1000)}` : "."}`;
  d.transaction(() => {
    d.prepare("UPDATE todos SET assignee_id = NULL, status = 'open', accept_status = 'accepted' WHERE id = ?").run(todoId);
    d.prepare("INSERT INTO todo_notes (todo_id, author_id, body, private) VALUES (?, ?, ?, 0)").run(todoId, memberId, body);
  })();
  return t;
}
