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
  [20160, "2 weeks before"],
];

// Leaders-only events show only to that organization's presidency and admins.
const VISIBLE = `(e.presidency_only = 0 OR EXISTS (SELECT 1 FROM org_members x WHERE x.org_id = e.org_id AND x.member_id = @viewer AND x.role <> 'member'))`;
const EVENT_COLUMNS = "e.*, CASE WHEN o.kind = 'ward' THEN w.name ELSE o.name END AS org_label, o.kind AS org_kind";
const EVENT_FROM = "events e JOIN orgs o ON o.id = e.org_id JOIN wards w ON w.id = o.ward_id";

/**
 * Events a member may see between two UTC instants: everything in a ward (the
 * ward calendar), only some organizations (filtered), or (joinedOnly) the
 * organizations they belong to in every ward they're in (their subscription).
 */
export function eventsBetween(
  viewerId: number,
  fromUtc: string,
  toUtc: string,
  where: { wardId?: number; orgIds?: number[]; joinedOnly?: boolean } = {},
): EventRow[] {
  const conds = ["e.starts_at < @to", "e.ends_at >= @from", VISIBLE, "o.ward_id IN (SELECT ward_id FROM ward_members WHERE member_id = @viewer)"];
  if (where.wardId) conds.push("o.ward_id = @ward");
  if (where.orgIds?.length) conds.push(`e.org_id IN (${where.orgIds.map(Number).join(",")})`);
  if (where.joinedOnly) conds.push("(o.kind = 'ward' OR EXISTS (SELECT 1 FROM org_members j WHERE j.org_id = e.org_id AND j.member_id = @viewer))");
  return db()
    .prepare(`SELECT ${EVENT_COLUMNS} FROM ${EVENT_FROM} WHERE ${conds.join(" AND ")} ORDER BY e.starts_at`)
    .all({ viewer: viewerId, from: fromUtc, to: toUtc, ward: where.wardId ?? 0 }) as EventRow[];
}

/** The "Add to Apple / Outlook calendar" link. It works without signing in, because iPhone opens it outside the installed app. */
export function icsPath(eventId: number, memberId: number) {
  return `/calendar/${eventId}/ics?m=${memberId}&t=${signToken(`ics:${eventId}:${memberId}`)}`;
}

export function validIcsToken(eventId: number, memberId: number, token: string) {
  return validToken(`ics:${eventId}:${memberId}`, token);
}

/** An event in any of the member's wards that they may see. */
export function getEvent(viewerId: number, id: number): EventRow | undefined {
  return db()
    .prepare(`SELECT ${EVENT_COLUMNS} FROM ${EVENT_FROM} WHERE e.id = @id AND ${VISIBLE} AND o.ward_id IN (SELECT ward_id FROM ward_members WHERE member_id = @viewer)`)
    .get({ id, viewer: viewerId }) as EventRow | undefined;
}

/** An event of the organization being managed (for its leaders' edit pages). */
export function getOrgEvent(user: CurrentUser, id: number): EventRow | undefined {
  return db()
    .prepare(`SELECT ${EVENT_COLUMNS} FROM ${EVENT_FROM} WHERE e.id = ? AND e.org_id = ? ${isAdmin(user) ? "" : "AND e.presidency_only = 0"}`)
    .get(id, user.org_id) as EventRow | undefined;
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

/** Reminder choices for a member's calendar (minutes before the event). */
export const CALENDAR_ALERT_OPTIONS: [number, string][] = [
  [15, "15 minutes before"],
  [30, "30 minutes before"],
  [60, "1 hour before"],
  [120, "2 hours before"],
  [1440, "1 day before"],
  [2880, "2 days before"],
  [10080, "1 week before"],
];

/** "1440,60" -> [1440, 60] (only allowed values, at most two). */
export function parseAlerts(value: string | null | undefined): number[] {
  const allowed = new Set(CALENDAR_ALERT_OPTIONS.map(([m]) => m));
  return [...new Set(String(value ?? "").split(",").map(Number))].filter((m) => allowed.has(m)).slice(0, 2);
}

function alarmLines(e: EventRow, minutes: number[]) {
  return minutes.flatMap((m) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(e.title)}`, `TRIGGER:-PT${m}M`, "END:VALARM"]);
}

function veventLines(e: EventRow, host: string, stamp: string, alerts: number[] = []) {
  return [
    "BEGIN:VEVENT",
    `UID:event-${e.id}@${host}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${gcal(e.starts_at)}`,
    `DTEND:${gcal(e.ends_at)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.location && `LOCATION:${icsEscape(e.location)}`,
    `DESCRIPTION:${icsEscape([e.description, `${appUrl()}/calendar/${e.id}`].filter(Boolean).join("\n\n"))}`,
    `URL:${appUrl()}/calendar/${e.id}`,
    ...alarmLines(e, alerts),
    "END:VEVENT",
  ].filter(Boolean) as string[];
}

const HEADER = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elders Quorum App//EN", "CALSCALE:GREGORIAN"];

export function icsFor(e: EventRow, alerts: number[] = [], host = new URL(appUrl()).host) {
  const lines = [...HEADER, "METHOD:PUBLISH", ...veventLines(e, host, gcal(DateTime.utc().toISO()!), alerts), "END:VCALENDAR"];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A whole subscribed calendar: every event the member may see, refreshed by their calendar app. */
export function icsFeed(events: EventRow[], calendarName: string, tz: string, alerts: number[] = [], host = new URL(appUrl()).host) {
  const stamp = gcal(DateTime.utc().toISO()!);
  const lines = [
    ...HEADER,
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    `X-WR-TIMEZONE:${tz}`,
    // Ask calendar apps to check for changes every hour (they may check less often).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap((e) => veventLines(e, host, stamp, alerts)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** The member's private subscription link (path only; see feedUrls for the full addresses). */
export function feedPath(member: { id: number; feed_version: number }) {
  return `/feed/${member.id}/${signToken(`feed:${member.id}:${member.feed_version}`)}.ics`;
}

export function validFeedToken(member: { id: number; feed_version: number }, token: string) {
  return validToken(`feed:${member.id}:${member.feed_version}`, token);
}

/** https (copy/Outlook), webcal (opens Apple Calendar's Subscribe), and Google Calendar's add-by-URL page. */
export function feedUrls(member: { id: number; feed_version: number }) {
  const https = appUrl() + feedPath(member);
  const webcal = https.replace(/^https?:/, "webcal:");
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}
