import { db } from "./db";
import { fillTemplate, templateDef } from "./template-defs";

export interface OrgTemplate {
  key: string;
  title: string | null;
  body: string;
  /** Its text-message wording, for the messages that have one. */
  text: string | null;
  custom: boolean;
  updated_by_name: string | null;
  updated_at: string | null;
}

/** An organization's wording for a message (its own, or the app's). */
export function orgTemplate(orgId: number, key: string): OrgTemplate {
  const def = templateDef(key);
  if (!def) throw new Error(`Unknown template ${key}`);
  const row = db()
    .prepare("SELECT t.title, t.body, t.text, t.updated_at, m.display_name AS updated_by_name FROM message_templates t LEFT JOIN members m ON m.id = t.updated_by WHERE t.org_id = ? AND t.key = ?")
    .get(orgId, key) as { title: string | null; body: string; text: string | null; updated_at: string; updated_by_name: string | null } | undefined;
  const text = def.text !== undefined ? (row?.text ?? def.text) : null;
  return row
    ? { key, title: def.title !== undefined ? (row.title ?? def.title) : null, body: row.body, text, custom: true, updated_by_name: row.updated_by_name, updated_at: row.updated_at }
    : { key, title: def.title ?? null, body: def.body, text, custom: false, updated_by_name: null, updated_at: null };
}

/** The message, in the organization's wording, with these details filled in. */
export function renderTemplate(orgId: number, key: string, vars: Record<string, string | null | undefined>): { title: string; body: string; textFull?: string } {
  const t = orgTemplate(orgId, key);
  return { title: t.title ? fillTemplate(t.title, vars) : "", body: fillTemplate(t.body, vars), ...(t.text ? { textFull: fillTemplate(t.text, vars) } : {}) };
}

export function saveTemplate(orgId: number, key: string, title: string | null, body: string, memberId: number, text: string | null = null) {
  db()
    .prepare(
      `INSERT INTO message_templates (org_id, key, title, body, text, updated_by) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, key) DO UPDATE SET title = excluded.title, body = excluded.body, text = excluded.text, updated_by = excluded.updated_by, updated_at = datetime('now')`,
    )
    .run(orgId, key, title, body, text, memberId);
}

export function resetTemplate(orgId: number, key: string) {
  db().prepare("DELETE FROM message_templates WHERE org_id = ? AND key = ?").run(orgId, key);
}
