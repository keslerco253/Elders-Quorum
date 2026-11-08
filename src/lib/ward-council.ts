import { db } from "./db";
import { addAgendaItem } from "./meetings";
import { formatDate } from "./time";

// Ward council, for an organization's presidency: things to share there for the whole
// ward (ticked off once shared), and things shared there to pass on to the
// organization, which can go on the next presidency meeting's agenda. Only that
// organization's presidency sees them.

export interface CouncilItem {
  id: number;
  org_id: number;
  kind: "share" | "from";
  body: string;
  /** The ward council it came from (yyyy-mm-dd), for "from" items. */
  council_date: string | null;
  shared_at: string | null;
  agenda_item_id: number | null;
  /** The agenda item is still waiting for the next meeting (not yet discussed and filed). */
  on_agenda: number;
  adder: string | null;
  created_at: string;
}

const SELECT = `SELECT w.*, m.display_name AS adder,
    CASE WHEN a.id IS NOT NULL AND a.meeting_id IS NULL THEN 1 ELSE 0 END AS on_agenda
  FROM ward_council_items w LEFT JOIN members m ON m.id = w.created_by LEFT JOIN agenda_items a ON a.id = w.agenda_item_id`;

/** Still to share at ward council, oldest first. */
export const toShare = (orgId: number) => db().prepare(`${SELECT} WHERE w.org_id = ? AND w.kind = 'share' AND w.shared_at IS NULL ORDER BY w.id`).all(orgId) as CouncilItem[];

/** Shared at ward council lately (the last 15). */
export const sharedLately = (orgId: number) =>
  db().prepare(`${SELECT} WHERE w.org_id = ? AND w.kind = 'share' AND w.shared_at IS NOT NULL ORDER BY w.shared_at DESC LIMIT 15`).all(orgId) as CouncilItem[];

/** What came from ward council to pass on, newest council first. */
export const fromCouncil = (orgId: number, limit = 60) =>
  db().prepare(`${SELECT} WHERE w.org_id = ? AND w.kind = 'from' ORDER BY w.council_date DESC, w.id DESC LIMIT ?`).all(orgId, limit) as CouncilItem[];

export function addCouncilItem(orgId: number, kind: "share" | "from", body: string, byId: number, councilDate: string | null): number {
  return Number(
    db()
      .prepare("INSERT INTO ward_council_items (org_id, kind, body, council_date, created_by) VALUES (?, ?, ?, ?, ?)")
      .run(orgId, kind, body.trim().slice(0, 2000), kind === "from" ? councilDate : null, byId).lastInsertRowid,
  );
}

export function getCouncilItem(orgId: number, id: number): CouncilItem | undefined {
  return db().prepare(`${SELECT} WHERE w.id = ? AND w.org_id = ?`).get(id, orgId) as CouncilItem | undefined;
}

/** Ticks a "to share" item off as shared (or back). */
export function setShared(orgId: number, id: number, shared: boolean) {
  db().prepare("UPDATE ward_council_items SET shared_at = CASE WHEN ? THEN datetime('now') END WHERE id = ? AND org_id = ? AND kind = 'share'").run(shared ? 1 : 0, id, orgId);
}

export function editCouncilItem(orgId: number, id: number, body: string) {
  const text = body.trim().slice(0, 2000);
  if (text) db().prepare("UPDATE ward_council_items SET body = ? WHERE id = ? AND org_id = ?").run(text, id, orgId);
}

export function deleteCouncilItem(orgId: number, id: number) {
  db().prepare("DELETE FROM ward_council_items WHERE id = ? AND org_id = ?").run(id, orgId);
}

/** Puts something from ward council on the next presidency meeting's agenda (once). Returns the agenda item's id. */
export function councilItemToAgenda(orgId: number, id: number, byId: number, section = "presidency"): number | null {
  const item = getCouncilItem(orgId, id);
  if (!item) return null;
  if (item.on_agenda && item.agenda_item_id) return item.agenda_item_id;
  const agendaId = addAgendaItem(orgId, item.body, {
    source: `From ward council${item.council_date ? `, ${formatDate(item.council_date, "short")}` : ""}`,
    link: "/admin/meetings/ward-council",
    addedBy: byId,
    section,
  });
  db().prepare("UPDATE ward_council_items SET agenda_item_id = ? WHERE id = ?").run(agendaId, id);
  return agendaId;
}
