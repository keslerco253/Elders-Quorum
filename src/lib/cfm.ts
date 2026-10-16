import { DateTime } from "luxon";
import { db } from "./db";
import { markGeneralConferences } from "./lessons";

// Come, Follow Me: each year's manual has a lesson for every week (Monday to Sunday).
// The site owner loads the schedule once a year; Sunday School's lessons are filled
// from it every week, and members get a weekly reminder of what to study.

export interface CfmWeek {
  /** The Sunday the week ends on (the lesson's date). */
  sunday: string;
  start: string;
  /** "Genesis 1–2; Moses 2–3" */
  reading: string;
  /** "“In the Beginning God Created the Heaven and the Earth”" */
  theme: string;
  url: string;
}

/** Only Sunday School's lessons come from Come, Follow Me. */
export const usesCfm = (org: { kind?: string; name?: string; label?: string }) => org.kind === "group" && /sunday school/i.test(org.name ?? org.label ?? "");

const BOOKS = ["old-testament", "new-testament", "book-of-mormon", "doctrine-and-covenants"];

/** The manual's address for a year (2026 is the Old Testament, then the New Testament, Book of Mormon, Doctrine and Covenants). */
export function manualUrl(year: number) {
  const book = BOOKS[(((year - 2026) % 4) + 4) % 4];
  return `https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-${book}-${year}`;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH = "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\\.?";
const ENTRY = new RegExp(`^${MONTH}\\s+(\\d{1,2})\\s*[–—-]\\s*(?:${MONTH}\\s+)?(\\d{1,2})(?:,?\\s*(\\d{4}))?\\s*[:.–—-]?\\s*(.*)$`, "i");
const QUOTE = /^[“"‘']/;
const monthNum = (m: string) => MONTHS.findIndex((x) => x.startsWith(m.toLowerCase().replace(".", "").slice(0, 3))) + 1;
const clean = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * Reads the manual's contents (copied from Gospel Library, or the text of its page):
 * lines like "January 5–11: Moses 1; Abraham 3", with the lesson's “title” on the
 * same line or the next. Lessons get a link to the manual page for that week.
 */
export function parseCfmContents(text: string, year: number, manual = manualUrl(year), links: string[] = []): CfmWeek[] {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const raw: { sm: number; sd: number; em: number; ed: number; y?: number; reading: string; theme: string }[] = [];
  for (const line of lines) {
    const m = line.match(ENTRY);
    if (m) {
      let rest = m[6] ?? "";
      let theme = "";
      const q = rest.search(/[“"]/);
      if (q > 0) {
        theme = rest.slice(q).trim();
        rest = rest.slice(0, q).trim();
      }
      raw.push({ sm: monthNum(m[1]), sd: Number(m[2]), em: m[3] ? monthNum(m[3]) : monthNum(m[1]), ed: Number(m[4]), y: m[5] ? Number(m[5]) : undefined, reading: rest.replace(/[:;,]$/, ""), theme });
      continue;
    }
    const last = raw.at(-1);
    if (!last) continue;
    if (QUOTE.test(line) && !last.theme) last.theme = line;
    else if (!last.reading && !last.theme) last.reading = line;
  }
  const weeks: CfmWeek[] = [];
  raw.forEach((r, i) => {
    if (!r.sm || !r.em || !r.reading) return;
    // The first week starts in the December before.
    const endYear = r.y ?? (r.em === 12 && i < 2 && raw.length > 10 ? year - 1 : year);
    const startYear = r.sm > r.em ? endYear - 1 : endYear;
    const start = DateTime.fromObject({ year: startYear, month: r.sm, day: r.sd });
    const end = DateTime.fromObject({ year: endYear, month: r.em, day: r.ed });
    if (!start.isValid || !end.isValid || end < start || end.diff(start, "days").days > 13) return;
    // The lesson's Sunday: the week's last day, or the Sunday in it.
    let sunday = end;
    while (sunday.weekday !== 7 && sunday > start) sunday = sunday.minus({ days: 1 });
    if (sunday.weekday !== 7) return;
    const link = links[i] || `${manual}/${String(i + 1).padStart(2, "0")}?lang=eng`;
    weeks.push({ sunday: sunday.toISODate()!, start: start.toISODate()!, reading: r.reading.slice(0, 200), theme: r.theme.slice(0, 200), url: link });
  });
  // One lesson per Sunday.
  return weeks.filter((w, i) => weeks.findIndex((x) => x.sunday === w.sunday) === i);
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

/** The text of a web page, a line per paragraph or link. */
export function pageText(html: string) {
  return decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/?(p|div|li|a|h\d|br|span|tr|td|header|section)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

/** Reads the manual's contents page: each week's link, with its dates, reading and title. */
export function parseCfmPage(html: string, year: number, manual = manualUrl(year)): CfmWeek[] {
  const path = new URL(manual).pathname;
  const lines: string[] = [];
  const links: string[] = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (let m; (m = re.exec(html)); ) {
    const href = decode(m[1]);
    if (!href.includes(path + "/")) continue;
    const text = pageText(m[2]).split("\n").map(clean).filter(Boolean);
    if (!text.length || !ENTRY.test(text[0]) && !text.some((t) => ENTRY.test(t))) continue;
    const at = text.findIndex((t) => ENTRY.test(t));
    lines.push(...text.slice(at));
    links.push(new URL(href, "https://www.churchofjesuschrist.org").toString());
  }
  const fromLinks = parseCfmContents(lines.join("\n"), year, manual, links);
  return fromLinks.length >= 10 ? fromLinks : parseCfmContents(pageText(html), year, manual);
}

/** Loads the schedule from the Church's website. */
export async function fetchCfmSchedule(year: number, manual = manualUrl(year)): Promise<CfmWeek[]> {
  const res = await fetch(`${manual}?lang=eng`, { headers: { "user-agent": "Mozilla/5.0 (My Ward Link)", accept: "text/html" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`The Church website answered ${res.status}.`);
  return parseCfmPage(await res.text(), year, manual);
}

/** Saves a schedule, and updates Sunday School lessons filled from it that nobody has changed. */
export function saveCfmSchedule(weeks: CfmWeek[]) {
  const d = db();
  const put = d.prepare("INSERT INTO cfm_weeks (sunday, start, reading, theme, url) VALUES (?, ?, ?, ?, ?) ON CONFLICT(sunday) DO UPDATE SET start = excluded.start, reading = excluded.reading, theme = excluded.theme, url = excluded.url");
  d.transaction(() => {
    for (const w of weeks) put.run(w.sunday, w.start, w.reading, w.theme, w.url);
    d.prepare(
      `UPDATE lessons SET title = w.reading, speaker = w.theme, url = w.url
       FROM cfm_weeks w WHERE w.sunday = lessons.date AND lessons.cfm_auto = 1`,
    ).run();
  })();
}

export function cfmYears(): { year: string; weeks: number; first: string; last: string }[] {
  return db().prepare("SELECT substr(sunday, 1, 4) AS year, COUNT(*) AS weeks, MIN(sunday) AS first, MAX(sunday) AS last FROM cfm_weeks GROUP BY 1 ORDER BY 1").all() as never;
}

export function deleteCfmYear(year: string) {
  db().prepare("DELETE FROM cfm_weeks WHERE substr(sunday, 1, 4) = ?").run(year);
}

/** The week a date falls in (Monday to Sunday). */
export function cfmWeekOf(date: string): CfmWeek | undefined {
  return db().prepare("SELECT * FROM cfm_weeks WHERE start <= ? AND sunday >= ? ORDER BY sunday LIMIT 1").get(date, date) as CfmWeek | undefined;
}

export function cfmWeekOn(sunday: string): CfmWeek | undefined {
  return db().prepare("SELECT * FROM cfm_weeks WHERE sunday = ?").get(sunday) as CfmWeek | undefined;
}

export function lastCfmSunday(): string | undefined {
  return (db().prepare("SELECT MAX(sunday) AS s FROM cfm_weeks").get() as { s: string | null }).s ?? undefined;
}

/**
 * Sunday School: a lesson for every week of the schedule from today on, each filled
 * from Come, Follow Me unless it was already filled or changed by hand.
 */
export function ensureCfmLessons(orgId: number, today: string): number {
  const d = db();
  let filled = 0;
  d.transaction(() => {
    d.prepare("INSERT OR IGNORE INTO lessons (org_id, date) SELECT ?, sunday FROM cfm_weeks WHERE sunday >= ?").run(orgId, today);
    markGeneralConferences(orgId, today);
    filled = d
      .prepare(
        `UPDATE lessons SET title = w.reading, speaker = w.theme, url = w.url, cfm_auto = 1
         FROM cfm_weeks w
         WHERE w.sunday = lessons.date AND lessons.org_id = ? AND lessons.date >= ? AND lessons.kind = 'talk' AND lessons.title = '' AND lessons.url = ''`,
      )
      .run(orgId, today).changes;
  })();
  return filled;
}

/** Puts a lesson back to that week's Come, Follow Me lesson. */
export function refillCfmLesson(orgId: number, lessonId: number): boolean {
  return (
    db()
      .prepare(
        `UPDATE lessons SET kind = 'talk', title = w.reading, speaker = w.theme, url = w.url, cfm_auto = 1
         FROM cfm_weeks w WHERE w.sunday = lessons.date AND lessons.id = ? AND lessons.org_id = ?`,
      )
      .run(lessonId, orgId).changes > 0
  );
}
