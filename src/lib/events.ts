import { DateTime } from "luxon";
import { signToken, validToken } from "./signed-links";
import { db } from "./db";
import { appUrl } from "./config";
import { isAdmin } from "./permissions";
import type { CurrentUser, EventRow } from "./types";

export const REMINDER_OPTIONS: [number | null, string][] = [
  [null, "No reminder"],
  [60, "1 hour before"],
  [180, "3 hours before"],
  [1440, "1 day before"],
  [2880, "2 days before"],
  [10080, "1 week before"],
];

/** Events the user may see between two UTC instants. */
export function eventsBetween(user: CurrentUser, fromUtc: string, toUtc: string): EventRow[] {
  return db()
    .prepare(`SELECT * FROM events WHERE ward_id = ? AND starts_at < ? AND ends_at >= ? ${isAdmin(user) ? "" : "AND presidency_only = 0"} ORDER BY starts_at`)
    .all(user.ward_id, toUtc, fromUtc) as EventRow[];
}

/** The "Add to Apple / Outlook calendar" link. It works without signing in, because iPhone opens it outside the installed app. */
export function icsPath(eventId: number, memberId: number) {
  return `/calendar/${eventId}/ics?m=${memberId}&t=${signToken(`ics:${eventId}:${memberId}`)}`;
}

export function validIcsToken(eventId: number, memberId: number, token: string) {
  return validToken(`ics:${eventId}:${memberId}`, token);
}

export function getEvent(user: CurrentUser, id: number): EventRow | undefined {
  return db()
    .prepare(`SELECT * FROM events WHERE id = ? AND ward_id = ? ${isAdmin(user) ? "" : "AND presidency_only = 0"}`)
    .get(id, user.ward_id) as EventRow | undefined;
}

const gcal = (iso: string) => DateTime.fromISO(iso, { zone: "utc" }).toFormat("yyyyLLdd'T'HHmmss'Z'");

export function googleCalendarUrl(e: EventRow) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${gcal(e.starts_at)}/${gcal(e.ends_at)}`,
    details: [e.description, `${appUrl()}/calendar/${e.id}`].filter(Boolean).join("\n\n"),
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** iPhone or iPad. */
export function isAppleMobile(ua: string | null) {
  return !!ua && /iPhone|iPad|iPod/.test(ua);
}

/** iPhone browsers other than Safari (Chrome, Firefox, Edge) can't hand a calendar file to the Calendar app. */
export function isNonSafariIos(ua: string | null) {
  return isAppleMobile(ua) && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua!);
}

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

/** Folds long lines to 75 octets as the iCalendar spec requires. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let n = 75;
    while (Buffer.byteLength(rest.slice(0, n)) > 75) n--;
    out.push(rest.slice(0, n));
    rest = " " + rest.slice(n);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function icsFor(e: EventRow, host = new URL(appUrl()).host) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elders Quorum App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${e.id}@${host}`,
    `DTSTAMP:${gcal(DateTime.utc().toISO()!)}`,
    `DTSTART:${gcal(e.starts_at)}`,
    `DTEND:${gcal(e.ends_at)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.location && `LOCATION:${icsEscape(e.location)}`,
    `DESCRIPTION:${icsEscape([e.description, `${appUrl()}/calendar/${e.id}`].filter(Boolean).join("\n\n"))}`,
    `URL:${appUrl()}/calendar/${e.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];
  return lines.map(fold).join("\r\n") + "\r\n";
}
