import { DateTime } from "luxon";
import { db } from "./db";
import { sha256 } from "./auth-core";
import { signToken, validToken } from "./signed-links";
import { currentUserFor, hasFeature, myOrgs } from "./orgs";
import { upcomingLessons } from "./lessons";
import { cfmWeekOf, usesCfm } from "./cfm";
import { eventsBetween } from "./events";
import { eventHref, personalEventsBetween } from "./personal-events";
import { myAssignments } from "./assignments";
import { unreadAnswers, leaderUnread } from "./conversations";
import { unreadAnnouncements } from "./member-inbox";
import { unreadNotifications } from "./notification-log";
import { currentLessonDate, formatDate } from "./time";
import { noLessonLabel, type CurrentUser, type LessonKind, type Member } from "./types";

const conferenceLabelText = (kind: LessonKind) => noLessonLabel(kind);

// The phone's home-screen widget. It can't use the app's sign-in cookie, so the
// app gets a widget key for its session: the session's (hashed) id plus a
// signature. Signing out ends the session, and with it the key.

export function widgetKeyFor(rawSessionId: string) {
  const id = sha256(rawSessionId);
  return `${id}.${signToken(`widget:${id}`)}`;
}

export function widgetUser(key: string | null | undefined): CurrentUser | null {
  const [id, sig] = String(key || "").split(".");
  if (!id || !sig || !/^[0-9a-f]{64}$/.test(id) || !validToken(`widget:${id}`, sig)) return null;
  const member = db()
    .prepare("SELECT m.* FROM sessions s JOIN members m ON m.id = s.member_id WHERE s.id = ? AND s.expires_at > ? AND m.status = 'active'")
    .get(id, DateTime.utc().toISO()) as Member | undefined;
  return member ? currentUserFor(member, member.last_org_id ?? undefined) : null;
}

export interface WidgetData {
  ward: string;
  /** This Sunday's lesson in their organization (or "General Conference"). */
  lesson: { org: string; when: string; title: string; subtitle: string; path: string } | null;
  /** This week's Come, Follow Me reading. */
  study: { reading: string; theme: string; path: string } | null;
  /** The next event they'd see on their calendar. */
  event: { title: string; when: string; path: string } | null;
  /** The next few events (for the large widget). */
  events: { title: string; when: string; path: string }[];
  unread: number;
}

export function widgetData(user: CurrentUser, now: DateTime = DateTime.utc()): WidgetData {
  const tz = user.ward.timezone;
  const local = now.setZone(tz);
  const today = local.toISODate()!;
  const orgs = myOrgs(user.id).filter((o) => o.ward_id === user.ward_id && hasFeature(o, "lessons"));
  // Their current organization's lesson first, else the first one with a lesson coming up.
  const ordered = [...orgs.filter((o) => o.id === user.org_id && !usesCfm(o)), ...orgs.filter((o) => o.id !== user.org_id && !usesCfm(o)), ...orgs.filter(usesCfm)];
  const sunday = currentLessonDate(tz, now);
  let lesson: WidgetData["lesson"] = null;
  for (const o of ordered) {
    const l = upcomingLessons(o.id, sunday, 1)[0];
    if (!l || l.date !== sunday) continue;
    const conf = conferenceLabelText(l.kind);
    lesson = {
      org: o.label,
      when: l.date === today ? "Today" : "This Sunday",
      title: conf ?? (l.title || "Lesson to be announced"),
      subtitle: conf ? "No lesson this week" : l.speaker,
      path: `/lessons/${l.id}?org=${o.id}`,
    };
    break;
  }
  const week = cfmWeekOf(today);
  const ss = orgs.find(usesCfm);
  const ssLesson = ss && week ? upcomingLessons(ss.id, week.sunday, 1).find((l) => l.date === week.sunday) : undefined;
  const study = week ? { reading: week.reading, theme: week.theme, path: ssLesson && ss ? `/lessons/${ssLesson.id}?org=${ss.id}` : "/" } : null;
  // Coming up, as on Home: calendar events, their own events, and what's on their plate
  // with a date (assignments, to-dos, lessons they teach, service, visits), in order.
  const dayWord = (d: DateTime) => (d.toISODate() === today ? "Today" : d.toISODate() === local.plus({ days: 1 }).toISODate() ? "Tomorrow" : formatDate(d.toISODate()!, "short"));
  const from = now.toISO()!;
  const to = now.plus({ days: 45 }).toISO()!;
  const until = local.plus({ days: 45 }).toISODate()!;
  const items = [
    ...[...eventsBetween(user.id, from, to, { joinedOnly: true }), ...personalEventsBetween(user.id, from, to)].map((e) => {
      const s = DateTime.fromISO(e.starts_at).setZone(tz);
      return {
        at: e.starts_at,
        title: e.title,
        when: e.all_day ? `${dayWord(s)} · All day` : `${dayWord(s)} · ${s.toFormat("h:mm a")}`,
        path: e.personal_event_id ? eventHref(e) : `/calendar/${e.id}?org=${e.org_id}`,
      };
    }),
    ...myAssignments(user.id, today)
      .filter((i) => !i.done && i.date && i.date >= today && i.date <= until)
      .map((i) => {
        const d = DateTime.fromISO(`${i.date}T${i.time ?? (i.kind === "teach" ? "09:00" : "23:59")}`, { zone: tz });
        return {
          at: d.toUTC().toISO()!,
          title: i.kind === "todo" || i.kind === "mine" ? `Due: ${i.title}` : i.title,
          when: i.time ? `${dayWord(d)} · ${d.toFormat("h:mm a")}` : dayWord(d),
          path: i.href.startsWith("/") && !i.href.includes("org=") && i.orgId ? `${i.href}${i.href.includes("?") ? "&" : "?"}org=${i.orgId}` : i.href,
        };
      }),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const events = items.slice(0, 5).map(({ title, when, path }) => ({ title, when, path }));
  const event = events[0] ?? null;
  const unread = unreadAnswers(user.id) + unreadAnnouncements(user.id) + leaderUnread(user.id) + unreadNotifications(user.id);
  return { ward: user.ward.name, lesson, study, event, events, unread };
}
