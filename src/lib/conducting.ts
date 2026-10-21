import { db } from "./db";
import { lessonOn } from "./lessons";
import { getOrg } from "./orgs";
import { sundays } from "./time";
import { callingLabel, type Calling } from "./types";

// Who conducts each Sunday. It follows the presidency's callings by month: the
// president (or bishop) January, April, July and October; the first counselor
// February, May, August and November; the second counselor March, June, September
// and December. Someone who can't be there asks another presidency member; once
// they accept, they conduct that Sunday.

const ROTATION: Calling[][] = [
  ["president", "bishop"],
  ["first_counselor"],
  ["second_counselor"],
];

/** Which calling conducts in a month (1-12). */
export const conductingCallings = (month: number) => ROTATION[(month - 1) % 3];

export interface Conductor {
  date: string;
  /** Who conducts (null when no one has that calling). */
  memberId: number | null;
  name: string | null;
  /** "First Counselor", whose month it is. */
  calling: string;
  /** Who it was, if someone else took it. */
  insteadOf: string | null;
  /** A conference Sunday: no meeting to conduct. */
  conference: string | null;
  /** A request waiting for an answer. */
  pending: { id: number; toId: number; toName: string; fromId: number | null } | null;
}

interface Person {
  id: number;
  name: string;
  calling: Calling | null;
}

/** The presidency (bishopric) with their callings. */
export function presidencyWithCallings(orgId: number): Person[] {
  return db()
    .prepare(
      `SELECT m.id, m.display_name AS name, om.calling FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
       WHERE om.role = 'presidency' AND m.status = 'active' ORDER BY m.display_name COLLATE NOCASE`,
    )
    .all(orgId) as Person[];
}

/** Who conducts on each of the next `weeks` Sundays from `from`. */
export function conductingSchedule(orgId: number, from: string, weeks = 8): Conductor[] {
  const org = getOrg(orgId);
  const people = presidencyWithCallings(orgId);
  const d = db();
  return sundays(from, weeks).map((date) => {
    const callings = conductingCallings(Number(date.slice(5, 7)));
    const scheduled = people.find((p) => p.calling && callings.includes(p.calling));
    // The latest accepted swap for that Sunday wins.
    const swap = d
      .prepare(
        `SELECT s.to_id, m.display_name AS name FROM conducting_swaps s JOIN members m ON m.id = s.to_id
         WHERE s.org_id = ? AND s.date = ? AND s.status = 'accepted' ORDER BY s.decided_at DESC, s.id DESC LIMIT 1`,
      )
      .get(orgId, date) as { to_id: number; name: string } | undefined;
    const pending = d
      .prepare(
        `SELECT s.id, s.to_id AS toId, m.display_name AS toName, s.from_id AS fromId FROM conducting_swaps s JOIN members m ON m.id = s.to_id
         WHERE s.org_id = ? AND s.date = ? AND s.status = 'pending' ORDER BY s.id DESC LIMIT 1`,
      )
      .get(orgId, date) as Conductor["pending"] | undefined;
    const lesson = lessonOn(orgId, date);
    const conference = lesson && lesson.kind !== "talk" ? (lesson.kind === "general_conference" ? "General Conference" : "Stake Conference") : null;
    const calling = org ? callingLabel(callings.length > 1 ? (org.kind === "ward" ? "bishop" : "president") : callings[0], org) : "";
    return {
      date,
      memberId: swap?.to_id ?? scheduled?.id ?? null,
      name: swap?.name ?? scheduled?.name ?? null,
      calling,
      insteadOf: swap && scheduled && swap.to_id !== scheduled.id ? scheduled.name : null,
      conference,
      pending: pending ?? null,
    };
  });
}

/** Asks another presidency member to conduct a Sunday (replacing an unanswered ask). Returns an error, or the request id. */
export function askToConduct(orgId: number, date: string, fromId: number, toId: number, note: string, today: string): { error: string } | { id: number } {
  const slot = conductingSchedule(orgId, date, 1)[0];
  if (!slot || slot.date !== date || date < today) return { error: "Choose an upcoming Sunday." };
  if (slot.memberId !== fromId) return { error: "Only whoever is conducting that Sunday can ask someone else." };
  if (toId === fromId || !presidencyWithCallings(orgId).some((p) => p.id === toId)) return { error: "Choose someone else in the presidency." };
  const d = db();
  d.prepare("UPDATE conducting_swaps SET status = 'cancelled', decided_at = datetime('now') WHERE org_id = ? AND date = ? AND status = 'pending'").run(orgId, date);
  const id = Number(d.prepare("INSERT INTO conducting_swaps (org_id, date, from_id, to_id, note) VALUES (?, ?, ?, ?, ?)").run(orgId, date, fromId, toId, note.trim().slice(0, 300)).lastInsertRowid);
  return { id };
}

export interface SwapRequest {
  id: number;
  org_id: number;
  date: string;
  from_id: number | null;
  from_name: string | null;
  to_id: number;
  to_name: string;
  note: string;
  status: string;
}

export function getSwap(id: number): SwapRequest | undefined {
  return db()
    .prepare(
      `SELECT s.*, f.display_name AS from_name, t.display_name AS to_name FROM conducting_swaps s
       LEFT JOIN members f ON f.id = s.from_id JOIN members t ON t.id = s.to_id WHERE s.id = ?`,
    )
    .get(id) as SwapRequest | undefined;
}

/** Requests waiting on this person's answer, soonest first. */
export function swapsWaitingOn(memberId: number, today: string): SwapRequest[] {
  return db()
    .prepare(
      `SELECT s.*, f.display_name AS from_name, t.display_name AS to_name FROM conducting_swaps s
       LEFT JOIN members f ON f.id = s.from_id JOIN members t ON t.id = s.to_id
       WHERE s.to_id = ? AND s.status = 'pending' AND s.date >= ? ORDER BY s.date`,
    )
    .all(memberId, today) as SwapRequest[];
}

/** Accepts or declines a request (only the person asked, while it's waiting). */
export function answerSwap(id: number, memberId: number, accept: boolean): SwapRequest | null {
  const s = getSwap(id);
  if (!s || s.to_id !== memberId || s.status !== "pending") return null;
  db().prepare("UPDATE conducting_swaps SET status = ?, decided_at = datetime('now') WHERE id = ?").run(accept ? "accepted" : "declined", id);
  return { ...s, status: accept ? "accepted" : "declined" };
}

/** Withdraws an unanswered request (whoever asked). */
export function cancelSwap(id: number, memberId: number): boolean {
  return db().prepare("UPDATE conducting_swaps SET status = 'cancelled', decided_at = datetime('now') WHERE id = ? AND from_id = ? AND status = 'pending'").run(id, memberId).changes > 0;
}
