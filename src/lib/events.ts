import { DateTime } from "luxon";
import { formatDateTime } from "./time";
import { signToken, validToken } from "./signed-links";
import { db } from "./db";
import { appUrl } from "./config";
import { isAdmin } from "./permissions";
import type { CurrentUser, EventRow } from "./types";
import { audienceMembers, recipientById, type Recipient } from "./notify";

export const REMINDER_OPTIONS: [number | null, string][] = [
  [null, "No reminder"],
  [60, "1 hour before"],
  [180, "3 hours before"],
  [1440, "1 day before"],
  [2880, "2 days before"],
  [10080, "1 week before"],
  [20160, "2 weeks before"],
];

// Leaders-only events show only to that organization's presidency and admins, and a
// meeting the presidency invited people to, to those people too.
const VISIBLE = `(e.presidency_only = 0 OR EXISTS (SELECT 1 FROM org_members x WHERE x.org_id = e.org_id AND x.member_id = @viewer AND x.role <> 'member')
  OR EXISTS (SELECT 1 FROM meetings mt JOIN meeting_invitees mi ON mi.meeting_id = mt.id WHERE mt.event_id = e.id AND mt.kind = 'invited' AND mi.member_id = @viewer))`;
const EVENT_COLUMNS = `e.*, CASE WHEN o.kind = 'ward' THEN w.name ELSE o.name END AS org_label, o.kind AS org_kind,
  (SELECT mt.id FROM meetings mt WHERE mt.event_id = e.id AND mt.kind = 'invited') AS invited_meeting_id`;
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
  // An organization's calendar also shows events it was invited to (or the whole ward was).
  if (where.orgIds?.length) {
    const ids = where.orgIds.map(Number);
    conds.push(`(e.org_id IN (${ids.join(",")}) OR e.invited = 'ward' OR ${ids.map((id) => `instr(',' || e.invited || ',', ',${id},') > 0`).join(" OR ")})`);
  }
  if (where.joinedOnly) {
    conds.push(
      `(o.kind = 'ward' OR e.invited = 'ward' OR EXISTS (SELECT 1 FROM org_members j WHERE j.member_id = @viewer AND (j.org_id = e.org_id OR instr(',' || e.invited || ',', ',' || j.org_id || ',') > 0)))`,
    );
  }
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

/** An all-day event's dates as calendars want them: the first day, and the day after the last. */
const icsDays = (e: Pick<EventRow, "starts_at" | "ends_at">, tz: string) => {
  const { first, last } = allDayDates(e, tz);
  return { start: first.replace(/-/g, ""), end: DateTime.fromISO(last).plus({ days: 1 }).toFormat("yyyyLLdd") };
};

export function googleCalendarUrl(e: EventRow, tz = "America/Boise") {
  const days = e.all_day ? icsDays(e, tz) : null;
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: days ? `${days.start}/${days.end}` : `${gcal(e.starts_at)}/${gcal(e.ends_at)}`,
    details: [e.description, `${appUrl()}/calendar/${e.id}`].filter(Boolean).join("\n\n"),
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** iPhone or iPad. */
export function isAppleMobile(ua: string | null) {
  return !!ua && /iPhone|iPad|iPod/.test(ua);
}

// (Line breaks typed in a form arrive as \r\n; a bare \r would break the line in some calendar apps.)
const icsEscape = (s: string) => s.replace(/\r\n?/g, "\n").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

/** Folds long lines to 75 octets as the iCalendar spec requires. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let n = 75;
    while (Buffer.byteLength(rest.slice(0, n)) > 75) n--;
    // Never between the two halves of an emoji.
    if (/[\ud800-\udbff]/.test(rest[n - 1])) n--;
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
  // An all-day event's alerts count back from 9 AM on its day, not midnight.
  const trigger = (m: number) => {
    const offset = e.all_day ? 540 - m : -m;
    return offset < 0 ? `TRIGGER:-PT${-offset}M` : `TRIGGER:PT${offset}M`;
  };
  return minutes.flatMap((m) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(e.title)}`, trigger(m), "END:VALARM"]);
}

function veventLines(e: EventRow, host: string, stamp: string, alerts: number[] = [], tz = "America/Boise") {
  const days = e.all_day ? icsDays(e, tz) : null;
  // A member's own event (only in their feed) has its own id and page, and is private.
  const link = `${appUrl()}${e.personal_event_id ? `/calendar/mine/${e.personal_event_id}` : e.invited_meeting_id ? `/meetings/${e.invited_meeting_id}` : `/calendar/${e.id}`}`;
  return [
    "BEGIN:VEVENT",
    e.personal_event_id ? `UID:personal-${e.personal_event_id}@${host}` : `UID:event-${e.id}@${host}`,
    `DTSTAMP:${stamp}`,
    days ? `DTSTART;VALUE=DATE:${days.start}` : `DTSTART:${gcal(e.starts_at)}`,
    days ? `DTEND;VALUE=DATE:${days.end}` : `DTEND:${gcal(e.ends_at)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.location && `LOCATION:${icsEscape(e.location)}`,
    `DESCRIPTION:${icsEscape([e.description, link].filter(Boolean).join("\n\n"))}`,
    `URL:${link}`,
    e.personal_event_id && "CLASS:PRIVATE",
    ...alarmLines(e, alerts),
    "END:VEVENT",
  ].filter(Boolean) as string[];
}

const HEADER = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elders Quorum App//EN", "CALSCALE:GREGORIAN"];

export function icsFor(e: EventRow, alerts: number[] = [], host = new URL(appUrl()).host, tz = "America/Boise") {
  const lines = [...HEADER, "METHOD:PUBLISH", ...veventLines(e, host, gcal(DateTime.utc().toISO()!), alerts, tz), "END:VCALENDAR"];
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
    ...events.flatMap((e) => veventLines(e, host, stamp, alerts, tz)),
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

/** The organizations invited to an event, as ids (the whole ward: its ward-wide organization). */
export function invitedOrgIds(e: Pick<EventRow, "invited" | "org_id">, wardOrgId: number): number[] {
  if (!e.invited) return [];
  if (e.invited === "ward") return [wardOrgId];
  return e.invited.split(",").map(Number).filter((id) => id && id !== e.org_id);
}

/**
 * Who an event is for: its organization (or just its leaders, for a leaders-only
 * event), plus everyone in the organizations it invited.
 */
export function eventAudience(e: Pick<EventRow, "org_id" | "invited" | "presidency_only"> & { id?: number }, opts: { invitedOnly?: boolean } = {}): Recipient[] {
  // A meeting people were invited to: those who haven't said they can't come, and
  // whoever scheduled it.
  const meeting = e.presidency_only && e.id ? (db().prepare("SELECT id, created_by FROM meetings WHERE event_id = ? AND kind = 'invited'").get(e.id) as { id: number; created_by: number | null } | undefined) : undefined;
  if (meeting) {
    if (opts.invitedOnly) return [];
    const ids = (db().prepare("SELECT member_id FROM meeting_invitees WHERE meeting_id = ? AND (response IS NULL OR response = 'yes')").all(meeting.id) as { member_id: number }[]).map((r) => r.member_id);
    const declined = !!db().prepare("SELECT 1 FROM meeting_invitees WHERE meeting_id = ? AND member_id = ? AND response = 'no'").get(meeting.id, meeting.created_by ?? 0);
    if (meeting.created_by && !declined && !ids.includes(meeting.created_by)) ids.push(meeting.created_by);
    return ids.map((id) => recipientById(id, e.org_id)).filter((r): r is Recipient => !!r);
  }
  if (e.presidency_only) return opts.invitedOnly ? [] : audienceMembers(e.org_id, "admins");
  const wardOrg = db().prepare("SELECT w.id FROM orgs o JOIN orgs w ON w.ward_id = o.ward_id AND w.kind = 'ward' WHERE o.id = ?").get(e.org_id) as { id: number } | undefined;
  const orgs = invitedOrgIds(e, wardOrg?.id ?? 0);
  const all = (opts.invitedOnly ? orgs : [e.org_id, ...orgs]).flatMap((id) => audienceMembers(id, "everyone"));
  // Someone in two of them hears once.
  return all.filter((r, i) => all.findIndex((x) => x.id === r.id) === i);
}

/**
 * Lasts two days or more (like a temple open house running for months): shown as
 * "going on" through its dates, not as something on one day.
 */
export function isOngoing(e: { starts_at: string; ends_at: string }): boolean {
  return DateTime.fromISO(e.ends_at, { zone: "utc" }).diff(DateTime.fromISO(e.starts_at, { zone: "utc" }), "days").days >= 2;
}

/** "Mar 1 – Jun 30, 2027" (the years only when they're needed). */
export function spanText(e: { starts_at: string; ends_at: string }, tz: string): string {
  const a = DateTime.fromISO(e.starts_at, { zone: "utc" }).setZone(tz);
  const b = DateTime.fromISO(e.ends_at, { zone: "utc" }).setZone(tz);
  const thisYear = DateTime.now().setZone(tz).year;
  return `${a.toFormat(a.year === b.year ? "LLL d" : "LLL d, yyyy")} – ${b.toFormat(b.year === thisYear && a.year === b.year ? "LLL d" : "LLL d, yyyy")}`;
}

/** For lists: "Now through Jun 30" once it's started, or "Mar 1 – Jun 30" before. */
export function ongoingText(e: { starts_at: string; ends_at: string }, tz: string, now: DateTime = DateTime.now()): string {
  const started = DateTime.fromISO(e.starts_at, { zone: "utc" }) <= now;
  return started ? `Now through ${DateTime.fromISO(e.ends_at, { zone: "utc" }).setZone(tz).toFormat("LLL d")}` : spanText(e, tz);
}

// All-day events: from midnight to 11:59 PM of their days in the ward's time zone.

/** Midnight of the first day to 11:59 PM of the last (the same day without one), in UTC. */
export function allDayRange(startDate: string, endDate: string | null, tz: string): { start: string; end: string } {
  const first = DateTime.fromISO(startDate, { zone: tz }).startOf("day");
  const lastDay = endDate && endDate > startDate ? endDate : startDate;
  const last = DateTime.fromISO(lastDay, { zone: tz }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
  return { start: first.toUTC().toISO({ suppressMilliseconds: true })!, end: last.toUTC().toISO({ suppressMilliseconds: true })! };
}

/** An all-day event's first and last dates (local). */
export function allDayDates(e: Pick<EventRow, "starts_at" | "ends_at">, tz: string): { first: string; last: string } {
  return {
    first: DateTime.fromISO(e.starts_at, { zone: "utc" }).setZone(tz).toISODate()!,
    last: DateTime.fromISO(e.ends_at, { zone: "utc" }).setZone(tz).toISODate()!,
  };
}

/** "Thu, Nov 5 · All day", or "Thu, Nov 5 – Sat, Nov 7" for more than one day. */
export function allDayText(e: Pick<EventRow, "starts_at" | "ends_at">, tz: string): string {
  const { first, last } = allDayDates(e, tz);
  const f = (d: string) => DateTime.fromISO(d, { zone: tz }).toFormat("ccc, LLL d");
  return first === last ? `${f(first)} · All day` : `${f(first)} – ${f(last)}`;
}

/** When an event's own and members' reminders count back from: its start, or 9 AM on an all-day event's first day. */
export function reminderAnchor(e: Pick<EventRow, "starts_at" | "all_day">, tz: string): string {
  if (!e.all_day) return e.starts_at;
  return DateTime.fromISO(e.starts_at, { zone: "utc" }).setZone(tz).set({ hour: 9, minute: 0, second: 0 }).toUTC().toISO({ suppressMilliseconds: true })!;
}

/** The time line for an event in lists and messages: its date and time, or the all-day text. */
export function eventWhenText(e: Pick<EventRow, "starts_at" | "ends_at" | "all_day">, tz: string): string {
  return e.all_day ? allDayText(e, tz) : formatDateTime(e.starts_at, tz);
}
