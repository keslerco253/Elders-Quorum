import { db } from "./db";
import { homeOf } from "./orgs";
import { notify, recipientById, type Recipient } from "./notify";

// Suggestions for making the app better, from any member or leader. Each goes on the
// site owner's list (they're notified), who moves it to working on it, done or
// declined, with a note back the person sees (and is told about).

export type SuggestionStatus = "new" | "working" | "done" | "declined";
export const SUGGESTION_STATUSES: [SuggestionStatus, string][] = [
  ["new", "New"],
  ["working", "Working on it"],
  ["done", "Done"],
  ["declined", "Not adding"],
];
export const statusLabel = (s: string) => SUGGESTION_STATUSES.find(([k]) => k === s)?.[1] ?? s;

export interface Suggestion {
  id: number;
  member_id: number | null;
  org_id: number | null;
  body: string;
  status: SuggestionStatus;
  owner_note: string;
  created_at: string;
  updated_at: string;
  member_name: string | null;
  /** "Villas Ward Elders Quorum": where they were in the app. */
  org_name: string | null;
}

const SELECT = `SELECT s.*, m.display_name AS member_name,
    CASE WHEN o.kind = 'ward' THEN w.name ELSE w.name || ' ' || o.name END AS org_name
  FROM app_suggestions s LEFT JOIN members m ON m.id = s.member_id LEFT JOIN orgs o ON o.id = s.org_id LEFT JOIN wards w ON w.id = o.ward_id`;

/** The site owner(s), as people to notify. */
function owners(): Recipient[] {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const rows = db().prepare("SELECT id FROM members WHERE status = 'active' AND (is_site_owner = 1 OR (lower(email) = ? AND email_verified_at IS NOT NULL))").all(ownerEmail) as { id: number }[];
  return rows.flatMap((o) => {
    const home = homeOf(o.id);
    const r = home.orgId ? recipientById(o.id, home.orgId) : undefined;
    return r ? [r] : [];
  });
}

/** Saves a suggestion and tells the site owner. Returns its id. */
export async function addSuggestion(memberId: number, orgId: number, body: string, name: string): Promise<number> {
  const text = body.trim().slice(0, 3000);
  const id = Number(db().prepare("INSERT INTO app_suggestions (member_id, org_id, body) VALUES (?, ?, ?)").run(memberId, orgId, text).lastInsertRowid);
  await notify(owners(), { title: "New suggestion for the app", body: `${name}: ${text.length > 160 ? `${text.slice(0, 157)}…` : text}`, url: `/site/suggestions#s-${id}`, noReply: true });
  return id;
}

export const mySuggestions = (memberId: number) => db().prepare(`${SELECT} WHERE s.member_id = ? ORDER BY s.id DESC LIMIT 50`).all(memberId) as Suggestion[];

export function suggestionsWith(status: SuggestionStatus): Suggestion[] {
  return db().prepare(`${SELECT} WHERE s.status = ? ORDER BY ${status === "new" ? "s.id" : "s.updated_at DESC"} LIMIT 200`).all(status) as Suggestion[];
}

export function suggestionCounts(): Record<SuggestionStatus, number> {
  const rows = db().prepare("SELECT status, COUNT(*) AS n FROM app_suggestions GROUP BY status").all() as { status: SuggestionStatus; n: number }[];
  return Object.fromEntries(SUGGESTION_STATUSES.map(([k]) => [k, rows.find((r) => r.status === k)?.n ?? 0])) as Record<SuggestionStatus, number>;
}

/** The site owner moves a suggestion along (with an optional note back); the person is told unless `tell` is false. */
export async function setSuggestionStatus(id: number, status: SuggestionStatus, note: string, tell: boolean): Promise<boolean> {
  const before = db().prepare(`${SELECT} WHERE s.id = ?`).get(id) as Suggestion | undefined;
  if (!before) return false;
  db().prepare("UPDATE app_suggestions SET status = ?, owner_note = ?, updated_at = datetime('now') WHERE id = ?").run(status, note.trim().slice(0, 1000), id);
  if (tell && before.member_id && before.org_id && status !== before.status) {
    const who = recipientById(before.member_id, before.org_id);
    const words: Record<SuggestionStatus, string> = { new: "is back on the list", working: "is being worked on", done: "has been added", declined: "won't be added for now" };
    if (who)
      await notify([who], {
        title: "Your suggestion for the app",
        body: `"${before.body.length > 80 ? `${before.body.slice(0, 77)}…` : before.body}" ${words[status]}.${note.trim() ? ` ${note.trim()}` : ""} Thank you!`,
        url: "/more/suggest",
        noReply: true,
      });
  }
  return true;
}
