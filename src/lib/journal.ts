import crypto from "crypto";
import { DateTime } from "luxon";
import { db, getSetting, setSetting } from "./db";
import { makeDocx, type DocxBlock } from "./docx";
import { MAX_JOURNAL_ENTRY } from "./journal-limits";
import { formatDateTime } from "./time";

// A member's private journal: any number of entries on each day. Only the member ever
// sees it: no leader or site owner page shows journals, and the writing is stored
// encrypted (AES-256-GCM) so it can't be read by looking at the database. The key is
// JOURNAL_KEY when set, else one kept in the database's settings (so a backup restores
// journals too). Deleting the account deletes the journal.

export interface JournalEntry {
  id: number;
  /** The day it's for (YYYY-MM-DD, the member's ward's time zone). */
  date: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export { MAX_JOURNAL_ENTRY };

function key(): Buffer {
  const env = process.env.JOURNAL_KEY?.trim();
  if (env) return crypto.createHash("sha256").update(env).digest();
  let k = getSetting("journal_key");
  if (!k) {
    k = crypto.randomBytes(32).toString("base64");
    setSetting("journal_key", k);
  }
  return Buffer.from(k, "base64");
}

export function sealText(text: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const out = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `v1:${Buffer.concat([iv, c.getAuthTag(), out]).toString("base64")}`;
}

export function openText(stored: string): string {
  if (!stored.startsWith("v1:")) return stored;
  try {
    const raw = Buffer.from(stored.slice(3), "base64");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return "(This entry couldn't be opened.)";
  }
}

type Row = Omit<JournalEntry, "body"> & { body: string };
const opened = (r: Row): JournalEntry => ({ ...r, body: openText(r.body) });
const COLS = "id, date, body, created_at, updated_at";

export const validDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && DateTime.fromISO(v).isValid ? v : null);

export function addJournalEntry(memberId: number, date: string, body: string): number {
  return Number(
    db()
      .prepare("INSERT INTO journal_entries (member_id, date, body) VALUES (?, ?, ?)")
      .run(memberId, date, sealText(body.slice(0, MAX_JOURNAL_ENTRY))).lastInsertRowid,
  );
}

/** False when it isn't theirs (or was deleted). */
export function updateJournalEntry(memberId: number, id: number, body: string): boolean {
  return (
    db()
      .prepare("UPDATE journal_entries SET body = ?, updated_at = datetime('now') WHERE id = ? AND member_id = ?")
      .run(sealText(body.slice(0, MAX_JOURNAL_ENTRY)), id, memberId).changes > 0
  );
}

export function deleteJournalEntry(memberId: number, id: number) {
  db().prepare("DELETE FROM journal_entries WHERE id = ? AND member_id = ?").run(id, memberId);
}

export function journalEntry(memberId: number, id: number): JournalEntry | null {
  const r = db().prepare(`SELECT ${COLS} FROM journal_entries WHERE id = ? AND member_id = ?`).get(id, memberId) as Row | undefined;
  return r ? opened(r) : null;
}

/** A day's entries, in the order they were written. */
export function journalDay(memberId: number, date: string): JournalEntry[] {
  return (db().prepare(`SELECT ${COLS} FROM journal_entries WHERE member_id = ? AND date = ? ORDER BY created_at, id`).all(memberId, date) as Row[]).map(opened);
}

/**
 * Entries between two days (either may be left open), oldest first, skipping blank
 * ones; `q` keeps those that contain it. The writing is encrypted, so searching reads
 * through the member's own entries.
 */
export function journalEntries(memberId: number, o: { from?: string | null; to?: string | null; q?: string } = {}): JournalEntry[] {
  const rows = db()
    .prepare(`SELECT ${COLS} FROM journal_entries WHERE member_id = ? AND date >= ? AND date <= ? ORDER BY date, created_at, id`)
    .all(memberId, o.from || "0000-01-01", o.to || "9999-12-31") as Row[];
  const q = o.q?.trim().toLowerCase();
  return rows.map(opened).filter((e) => e.body.trim() && (!q || e.body.toLowerCase().includes(q)));
}

export type JournalRange = "all" | "year" | "dates";

/** What to print or download: the whole journal, this year, or chosen days. */
export function journalRange(sp: { range?: string; from?: string; to?: string }, tz: string) {
  const today = DateTime.now().setZone(tz);
  if (sp.range === "year") return { range: "year" as const, from: `${today.year}-01-01`, to: `${today.year}-12-31` };
  if (sp.range === "dates") {
    const from = validDate(sp.from);
    const to = validDate(sp.to);
    return { range: "dates" as const, from, to: from && to && to < from ? from : to };
  }
  return { range: "all" as const, from: null, to: null };
}

export const longDate = (date: string) => DateTime.fromISO(date).toFormat("cccc, LLLL d, yyyy");
const entryTime = (e: JournalEntry, tz: string) => formatDateTime(e.created_at, tz, "h:mm a");

function rangeText(entries: JournalEntry[], from: string | null, to: string | null) {
  const a = from ?? entries[0]?.date;
  const b = to ?? entries.at(-1)?.date;
  if (!a || !b) return "";
  const f = (d: string) => DateTime.fromISO(d).toFormat("LLLL d, yyyy");
  return a === b ? f(a) : `${f(a)} – ${f(b)}`;
}

/** Entries by day. */
function byDay(entries: JournalEntry[]) {
  const days: { date: string; entries: JournalEntry[] }[] = [];
  for (const e of entries) {
    if (days.at(-1)?.date !== e.date) days.push({ date: e.date, entries: [] });
    days.at(-1)!.entries.push(e);
  }
  return days;
}

const html = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The journal as a page of its own, to print or save as a PDF: each day as a heading,
 * each entry under it with the time it was written. With `toolbar`, a Print button
 * (and the print screen opens by itself).
 */
export function journalBookHtml(o: { name: string; entries: JournalEntry[]; tz: string; from: string | null; to: string | null; toolbar?: boolean }) {
  const title = `${o.name}'s Journal`;
  const days = byDay(o.entries)
    .map(
      (d) =>
        `<section class="day"><h2>${html(longDate(d.date))}</h2>${d.entries
          .map((e) => `<article><div class="time">${html(entryTime(e, o.tz))}</div><div class="body">${html(e.body.trim())}</div></article>`)
          .join("")}</section>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #1f2937; background: #fff; margin: 0 auto; max-width: 42rem; padding: 2rem 1.25rem; line-height: 1.55; }
  h1 { text-align: center; font-weight: normal; font-size: 2rem; margin: 0 0 .25rem; }
  .range { text-align: center; color: #6b7280; margin-bottom: 2.5rem; }
  h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: .25rem; break-after: avoid; }
  article { margin: 0 0 1rem; break-inside: avoid; }
  .time { color: #6b7280; font-size: .8rem; }
  .body { white-space: pre-wrap; overflow-wrap: anywhere; }
  .empty { text-align: center; color: #6b7280; }
  .bar { position: sticky; top: 0; background: #fff; display: flex; gap: .5rem; justify-content: flex-end; padding: .5rem 0 1rem; font-family: system-ui, sans-serif; }
  .bar button, .bar a { font: inherit; font-size: .9rem; padding: .45rem .9rem; border-radius: .5rem; border: 1px solid #d1d5db; background: #fff; color: #1f2937; text-decoration: none; cursor: pointer; }
  .bar button { background: #2563eb; border-color: #2563eb; color: #fff; }
  @media print { .bar { display: none; } body { padding: 0; max-width: none; } }
  @page { margin: .75in; }
</style></head><body>
${o.toolbar ? `<div class="bar"><a href="/journal/export">← Back</a><button type="button" onclick="window.print()">Print or save as PDF</button></div><script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</script>` : ""}
<h1>${html(title)}</h1>
<div class="range">${html(rangeText(o.entries, o.from, o.to))}</div>
${days || `<p class="empty">No journal entries for these days.</p>`}
</body></html>`;
}

/** The journal as a Word document. */
export function journalDocx(o: { name: string; entries: JournalEntry[]; tz: string; from: string | null; to: string | null }): Buffer {
  const blocks: DocxBlock[] = [
    { kind: "title", text: `${o.name}'s Journal` },
    { kind: "subtitle", text: rangeText(o.entries, o.from, o.to) },
  ];
  for (const d of byDay(o.entries)) {
    blocks.push({ kind: "heading", text: longDate(d.date) });
    for (const e of d.entries) {
      blocks.push({ kind: "note", text: entryTime(e, o.tz) });
      for (const line of e.body.trim().split(/\r?\n/)) blocks.push({ kind: "text", text: line });
    }
  }
  if (o.entries.length === 0) blocks.push({ kind: "text", text: "No journal entries for these days." });
  return makeDocx(blocks);
}

export const journalFileName = (name: string, ext: "docx" | "html") => `${name.replace(/[^\p{L}\p{N} .'-]/gu, "").trim() || "My"} Journal.${ext}`;
