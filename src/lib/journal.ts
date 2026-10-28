import crypto from "crypto";
import { DateTime } from "luxon";
import { db, getSetting, setSetting } from "./db";
import { makeDocx, type DocxBlock } from "./docx";
import { MAX_JOURNAL_ENTRY } from "./journal-limits";
import { formatDateTime } from "./time";

// A member's private journal: any number of entries on each day. Only the member ever
// sees it: no leader or site owner page shows journals, and the writing is stored
// encrypted (AES-256-GCM) so it can't be read by looking at the database.
//
// Two kinds of key:
// - Without a passcode ("v1:" entries): the site's journal key (see siteKeys). Whoever
//   runs the server could open these; members are told so.
// - With a passcode ("v2:" entries): the member's own random key, stored only wrapped
//   by a key made from their passcode (scrypt). The passcode itself isn't kept, so
//   without it nobody can read those entries, and a forgotten passcode can't be reset.
//   Functions take that key as `mk` once the member has unlocked their journal.
// Deleting the account deletes the journal.

export interface JournalEntry {
  id: number;
  /** The day it's for (YYYY-MM-DD, the member's ward's time zone). */
  date: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export { MAX_JOURNAL_ENTRY };

/** A member's own key, when their journal has a passcode and they've unlocked it. */
export type MemberKey = Buffer | null | undefined;

/**
 * The site's journal keys: JOURNAL_KEY (set in the server's settings, so it isn't in
 * the database or its backups) when it's set, else one kept in the database. The first
 * seals new writing; the database key still opens what was written before JOURNAL_KEY
 * was set.
 */
function siteKeys(): Buffer[] {
  const env = process.env.JOURNAL_KEY?.trim();
  const stored = getSetting("journal_key");
  const keys = env ? [crypto.createHash("sha256").update(env).digest()] : [];
  if (stored) keys.push(Buffer.from(stored, "base64"));
  else if (!env) {
    const k = crypto.randomBytes(32).toString("base64");
    setSetting("journal_key", k);
    keys.push(Buffer.from(k, "base64"));
  }
  return keys;
}

function seal(data: Buffer, k: Buffer) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv);
  const out = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), out]).toString("base64");
}

/** Throws when the key is wrong. */
function unseal(sealed: string, k: Buffer) {
  const raw = Buffer.from(sealed, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", k, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
}

export function sealText(text: string, mk?: MemberKey): string {
  return mk ? `v2:${seal(Buffer.from(text, "utf8"), mk)}` : `v1:${seal(Buffer.from(text, "utf8"), siteKeys()[0])}`;
}

export function openText(stored: string, mk?: MemberKey): string {
  const v = stored.slice(0, 3);
  if (v !== "v1:" && v !== "v2:") return stored;
  try {
    if (v === "v2:" && !mk) return "(Locked.)";
    if (v === "v2:") return unseal(stored.slice(3), mk!).toString("utf8");
    for (const k of siteKeys()) {
      try {
        return unseal(stored.slice(3), k).toString("utf8");
      } catch {
        // Written with the other key.
      }
    }
    throw new Error("no key");
  } catch {
    return "(This entry couldn't be opened.)";
  }
}

// ---- The optional passcode ----

export const MIN_PASSCODE = 6;
/**
 * How hard a passcode key is to work out (log2 of scrypt's N): about a quarter second
 * each, so trying passcodes against a copy of the database is slow. Each lock keeps
 * the cost it was made with.
 */
const PASS_COST = 16;
const passKey = (passcode: string, salt: Buffer, cost: number) =>
  crypto.scryptSync(passcode.normalize("NFKC"), salt, 32, { N: 2 ** cost, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });

export function hasJournalPasscode(memberId: number): boolean {
  return !!db().prepare("SELECT 1 FROM journal_locks WHERE member_id = ?").get(memberId);
}

/** The member's own key from their passcode, or null when it's wrong (or there's no passcode). */
export function unlockJournal(memberId: number, passcode: string): Buffer | null {
  const lock = db().prepare("SELECT salt, wrapped, cost FROM journal_locks WHERE member_id = ?").get(memberId) as { salt: string; wrapped: string; cost: number } | undefined;
  if (!lock) return null;
  try {
    return unseal(lock.wrapped, passKey(passcode, Buffer.from(lock.salt, "base64"), lock.cost));
  } catch {
    return null;
  }
}

function storeLock(memberId: number, passcode: string, mk: Buffer) {
  const salt = crypto.randomBytes(16);
  db()
    .prepare(
      `INSERT INTO journal_locks (member_id, salt, wrapped, cost) VALUES (?, ?, ?, ?)
       ON CONFLICT(member_id) DO UPDATE SET salt = excluded.salt, wrapped = excluded.wrapped, cost = excluded.cost, updated_at = datetime('now')`,
    )
    .run(memberId, salt.toString("base64"), seal(mk, passKey(passcode, salt, PASS_COST)), PASS_COST);
}

/** Every entry sealed again with another key (turning the passcode on or off). */
function reseal(memberId: number, from: MemberKey, to: MemberKey) {
  const rows = db().prepare("SELECT id, body FROM journal_entries WHERE member_id = ?").all(memberId) as { id: number; body: string }[];
  const put = db().prepare("UPDATE journal_entries SET body = ? WHERE id = ?");
  for (const r of rows) put.run(sealText(openText(r.body, from), to), r.id);
}

/** Turns the passcode on: a new key of their own, and every entry locked with it. Returns the key. */
export function setJournalPasscode(memberId: number, passcode: string): Buffer {
  const mk = crypto.randomBytes(32);
  db().transaction(() => {
    reseal(memberId, null, mk);
    storeLock(memberId, passcode, mk);
  })();
  return mk;
}

/** False when the current passcode is wrong. The entries keep their key. */
export function changeJournalPasscode(memberId: number, current: string, next: string): boolean {
  const mk = unlockJournal(memberId, current);
  if (!mk) return false;
  storeLock(memberId, next, mk);
  return true;
}

/** Turns the passcode off (entries go back to the site's key). False when it's wrong. */
export function removeJournalPasscode(memberId: number, current: string): boolean {
  const mk = unlockJournal(memberId, current);
  if (!mk) return false;
  db().transaction(() => {
    reseal(memberId, mk, null);
    db().prepare("DELETE FROM journal_locks WHERE member_id = ?").run(memberId);
  })();
  return true;
}

/** A forgotten passcode: the only way back in is to start the journal over. */
export function eraseJournal(memberId: number) {
  db().transaction(() => {
    db().prepare("DELETE FROM journal_entries WHERE member_id = ?").run(memberId);
    db().prepare("DELETE FROM journal_locks WHERE member_id = ?").run(memberId);
  })();
}

// ---- Entries ----

type Row = Omit<JournalEntry, "body"> & { body: string };
const COLS = "id, date, body, created_at, updated_at";

export const validDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && DateTime.fromISO(v).isValid ? v : null);

/** With a passcode, saving needs their key (so nothing is written that only the site could read). */
function sealFor(memberId: number, body: string, mk: MemberKey) {
  if (!mk && hasJournalPasscode(memberId)) throw new Error("journal locked");
  return sealText(body.slice(0, MAX_JOURNAL_ENTRY), mk);
}

export function addJournalEntry(memberId: number, date: string, body: string, mk?: MemberKey): number {
  return Number(
    db()
      .prepare("INSERT INTO journal_entries (member_id, date, body) VALUES (?, ?, ?)")
      .run(memberId, date, sealFor(memberId, body, mk)).lastInsertRowid,
  );
}

/** False when it isn't theirs (or was deleted). */
export function updateJournalEntry(memberId: number, id: number, body: string, mk?: MemberKey): boolean {
  return (
    db()
      .prepare("UPDATE journal_entries SET body = ?, updated_at = datetime('now') WHERE id = ? AND member_id = ?")
      .run(sealFor(memberId, body, mk), id, memberId).changes > 0
  );
}

export function deleteJournalEntry(memberId: number, id: number) {
  db().prepare("DELETE FROM journal_entries WHERE id = ? AND member_id = ?").run(id, memberId);
}

export function journalEntry(memberId: number, id: number, mk?: MemberKey): JournalEntry | null {
  const r = db().prepare(`SELECT ${COLS} FROM journal_entries WHERE id = ? AND member_id = ?`).get(id, memberId) as Row | undefined;
  return r ? { ...r, body: openText(r.body, mk) } : null;
}

/** A day's entries, in the order they were written. */
export function journalDay(memberId: number, date: string, mk?: MemberKey): JournalEntry[] {
  return (db().prepare(`SELECT ${COLS} FROM journal_entries WHERE member_id = ? AND date = ? ORDER BY created_at, id`).all(memberId, date) as Row[]).map((r) => ({
    ...r,
    body: openText(r.body, mk),
  }));
}

/**
 * Entries between two days (either may be left open), oldest first, skipping blank
 * ones; `q` keeps those that contain it. The writing is encrypted, so searching reads
 * through the member's own entries.
 */
export function journalEntries(memberId: number, o: { from?: string | null; to?: string | null; q?: string } = {}, mk?: MemberKey): JournalEntry[] {
  const rows = db()
    .prepare(`SELECT ${COLS} FROM journal_entries WHERE member_id = ? AND date >= ? AND date <= ? ORDER BY date, created_at, id`)
    .all(memberId, o.from || "0000-01-01", o.to || "9999-12-31") as Row[];
  const q = o.q?.trim().toLowerCase();
  return rows.map((r) => ({ ...r, body: openText(r.body, mk) })).filter((e) => e.body.trim() && (!q || e.body.toLowerCase().includes(q)));
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
 * (and the print screen opens by itself); "outside": opened outside the app, so
 * there's no Back link to the site.
 */
export function journalBookHtml(o: { name: string; entries: JournalEntry[]; tz: string; from: string | null; to: string | null; toolbar?: boolean | "outside" }) {
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
  .bar .tip { margin-right: auto; color: #6b7280; font-size: .8rem; align-self: center; }
  .bar button { background: #2563eb; border-color: #2563eb; color: #fff; }
  @media print { .bar { display: none; } body { padding: 0; max-width: none; } }
  @page { margin: .75in; }
</style></head><body>
${o.toolbar ? `<div class="bar">${o.toolbar === "outside" ? `<span class="tip">No print screen? Tap the Share button, then Print.</span>` : `<a href="/journal/export">← Back</a>`}<button type="button" onclick="window.print()">Print or save as PDF</button></div><script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</script>` : ""}
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
