import { DateTime } from "luxon";

export const DEFAULT_TZ = "America/Boise";

export function nowIn(tz: string) {
  return DateTime.now().setZone(tz);
}

/** Today's date (YYYY-MM-DD) in the ward's time zone. */
export function todayIn(tz: string) {
  return nowIn(tz).toISODate()!;
}

/** "2026-10-18" -> "Sunday, October 18, 2026" */
export function formatDate(isoDate: string, style: "long" | "short" = "long") {
  const d = DateTime.fromISO(isoDate);
  return style === "long" ? d.toFormat("cccc, LLLL d, yyyy") : d.toFormat("ccc, LLL d");
}

/** UTC ISO timestamp -> local display in the ward's zone. */
export function formatDateTime(utcIso: string, tz: string, fmt = "ccc, LLL d · h:mm a") {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toFormat(fmt);
}

export function formatTime(utcIso: string, tz: string) {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toFormat("h:mm a");
}

/** <input type="datetime-local"> value in the ward zone -> UTC ISO. */
export function localInputToUtc(value: string, tz: string): string | null {
  const d = DateTime.fromISO(value, { zone: tz });
  return d.isValid ? d.toUTC().toISO({ suppressMilliseconds: true }) : null;
}

/** UTC ISO -> <input type="datetime-local"> value in the ward zone. */
export function utcToLocalInput(utcIso: string, tz: string) {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toFormat("yyyy-LL-dd'T'HH:mm");
}

/** Next Sunday on or after the given date. */
export function sundayOnOrAfter(isoDate: string) {
  const d = DateTime.fromISO(isoDate);
  return d.plus({ days: (7 - (d.weekday % 7)) % 7 }).toISODate()!;
}

/** All Sundays from start (inclusive, rounded up to Sunday) for `count` weeks. */
export function sundays(startIso: string, count: number) {
  const first = DateTime.fromISO(sundayOnOrAfter(startIso));
  return Array.from({ length: count }, (_, i) => first.plus({ weeks: i }).toISODate()!);
}
