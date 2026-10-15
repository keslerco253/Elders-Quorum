import { db } from "./db";

export interface Signup {
  id: number;
  org_id: number;
  title: string;
  description: string;
  date: string | null;
  closed: number;
  /** A flyer: a PDF or picture (stored name, and the name it was uploaded with). */
  flyer_file: string | null;
  flyer_name: string | null;
  /** Reminders to people signed up: days before the date (0 = the morning of), or null for none. */
  reminder1_days: number | null;
  reminder2_days: number | null;
}

/** Choices for a service opportunity's reminders (days before its date). */
export const SIGNUP_REMINDER_OPTIONS: [number | null, string][] = [
  [null, "No reminder"],
  [0, "The morning of"],
  [1, "1 day before"],
  [2, "2 days before"],
  [3, "3 days before"],
  [7, "1 week before"],
  [14, "2 weeks before"],
];

export interface Slot {
  id: number;
  label: string;
  capacity: number;
  entries: { member_id: number; display_name: string; note: string }[];
}

export function listSignups(orgId: number, includeClosed: boolean, today: string) {
  return db()
    .prepare(
      `SELECT s.*,
        (SELECT COALESCE(SUM(capacity), 0) FROM signup_slots WHERE signup_id = s.id) AS capacity,
        (SELECT COUNT(*) FROM signup_entries e JOIN signup_slots sl ON sl.id = e.slot_id WHERE sl.signup_id = s.id) AS taken
       FROM signups s WHERE s.org_id = ? ${includeClosed ? "" : "AND s.closed = 0 AND (s.date IS NULL OR s.date >= ?)"}
       ORDER BY s.closed, s.date IS NULL, s.date, s.id DESC`,
    )
    .all(...(includeClosed ? [orgId] : [orgId, today])) as (Signup & { capacity: number; taken: number })[];
}

/** Every organization's service opportunities in a ward (for the ward-level Service page), with where each is from. */
export function listWardSignups(wardId: number, includeClosed: boolean, today: string) {
  return db()
    .prepare(
      `SELECT s.*, CASE WHEN o.kind = 'ward' THEN 'Ward' ELSE o.name END AS org_label,
        (SELECT COALESCE(SUM(capacity), 0) FROM signup_slots WHERE signup_id = s.id) AS capacity,
        (SELECT COUNT(*) FROM signup_entries e JOIN signup_slots sl ON sl.id = e.slot_id WHERE sl.signup_id = s.id) AS taken
       FROM signups s JOIN orgs o ON o.id = s.org_id
       WHERE o.ward_id = ? AND o.active = 1 ${includeClosed ? "" : "AND s.closed = 0 AND (s.date IS NULL OR s.date >= ?)"}
       ORDER BY s.closed, s.date IS NULL, s.date, s.id DESC`,
    )
    .all(...(includeClosed ? [wardId] : [wardId, today])) as (Signup & { capacity: number; taken: number; org_label: string })[];
}

export function getSignup(orgId: number, id: number) {
  const s = db().prepare("SELECT * FROM signups WHERE id = ? AND org_id = ?").get(id, orgId) as Signup | undefined;
  if (!s) return undefined;
  const slots = db().prepare("SELECT id, label, capacity FROM signup_slots WHERE signup_id = ? ORDER BY position, id").all(id) as Omit<Slot, "entries">[];
  const entries = db()
    .prepare("SELECT e.slot_id, e.member_id, e.note, m.display_name FROM signup_entries e JOIN members m ON m.id = e.member_id JOIN signup_slots sl ON sl.id = e.slot_id WHERE sl.signup_id = ? ORDER BY e.created_at")
    .all(id) as { slot_id: number; member_id: number; note: string; display_name: string }[];
  return { ...s, slots: slots.map((sl) => ({ ...sl, entries: entries.filter((e) => e.slot_id === sl.id) })) as Slot[] };
}

/** "Helpers | 6" lines -> slots. A line without a number means 1 spot. */
export function parseSlotLines(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.*?)\s*[|:]\s*(\d+)\s*$/);
      const label = (m ? m[1] : l).trim().slice(0, 120);
      const capacity = m ? Math.min(Math.max(Number(m[2]), 1), 500) : 1;
      return { label, capacity };
    })
    .filter((s) => s.label);
}

/** "1 person still needed", "3 people still needed". */
export const stillNeeded = (n: number) => `${n} ${n === 1 ? "person" : "people"} still needed`;
