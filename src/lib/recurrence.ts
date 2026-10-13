import { DateTime } from "luxon";

// Repeating-event patterns. Pure date math (no database), so the event form can
// use it in the browser to label the choices for the chosen start date.

export type Pattern = "weekly" | "biweekly" | "monthly_nth" | "monthly_last" | "monthly_day";

export interface Recurrence {
  pattern: Pattern;
  /** First date, yyyy-mm-dd (local to the ward). */
  start: string;
  /** Last allowed date, or null. */
  until: string | null;
  /** Total number of dates, or null. */
  count: number | null;
}

const ORDINALS = ["first", "second", "third", "fourth"];

function ordinalDay(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}

/** Which "nth weekday" a date is (1-5) and whether it's the last one in its month. */
function weekdayPosition(d: DateTime) {
  return { nth: Math.ceil(d.day / 7), last: d.plus({ days: 7 }).month !== d.month };
}

/** The repeat choices that make sense for a start date, e.g. "Every month on the third Friday". */
export function patternOptions(startDate: string): { value: Pattern; label: string }[] {
  const d = DateTime.fromISO(startDate);
  if (!d.isValid) return [];
  const day = d.toFormat("cccc");
  const { nth, last } = weekdayPosition(d);
  return [
    { value: "weekly", label: `Every week on ${day}` },
    { value: "biweekly", label: `Every 2 weeks on ${day}` },
    ...(nth <= 4 ? [{ value: "monthly_nth" as const, label: `Every month on the ${ORDINALS[nth - 1]} ${day}` }] : []),
    ...(last ? [{ value: "monthly_last" as const, label: `Every month on the last ${day}` }] : []),
    { value: "monthly_day", label: `Every month on the ${ordinalDay(d.day)}` },
  ];
}

export function describeRecurrence(r: Recurrence) {
  const label = patternOptions(r.start).find((o) => o.value === r.pattern)?.label ?? "Repeats";
  if (r.until) return `${label}, until ${DateTime.fromISO(r.until).toFormat("LLL d, yyyy")}`;
  if (r.count) return `${label}, ${r.count} times`;
  return label;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const first = DateTime.fromObject({ year, month, day: 1 });
  const d = first.plus({ days: (weekday - first.weekday + 7) % 7 + (nth - 1) * 7 });
  return d.month === month ? d : null;
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const last = DateTime.fromObject({ year, month, day: 1 }).endOf("month").startOf("day");
  return last.minus({ days: (last.weekday - weekday + 7) % 7 });
}

/** The k-th date of the series (k = 0 is the start), or null if that month has no such day. */
function nthDate(r: Recurrence, k: number): DateTime | null {
  const s = DateTime.fromISO(r.start);
  if (r.pattern === "weekly") return s.plus({ weeks: k });
  if (r.pattern === "biweekly") return s.plus({ weeks: 2 * k });
  const m = s.startOf("month").plus({ months: k });
  if (r.pattern === "monthly_nth") return nthWeekdayOfMonth(m.year, m.month, s.weekday, weekdayPosition(s).nth);
  if (r.pattern === "monthly_last") return lastWeekdayOfMonth(m.year, m.month, s.weekday);
  return s.day <= m.daysInMonth! ? m.set({ day: s.day }) : null; // e.g. no 31st in some months
}

/** Dates of the series between from and to (inclusive), yyyy-mm-dd, honoring until/count. */
export function occurrenceDates(r: Recurrence, from: string, to: string): string[] {
  const out: string[] = [];
  let made = 0;
  for (let k = 0; k < 2000; k++) {
    const d = nthDate(r, k);
    if (!d) continue;
    const iso = d.toISODate()!;
    if (iso > to || (r.until && iso > r.until) || (r.count && made >= r.count)) break;
    made++;
    if (iso >= from) out.push(iso);
  }
  return out;
}
