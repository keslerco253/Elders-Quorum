import { DateTime } from "luxon";
import { db } from "./db";
import { sha256 } from "./auth-core";
import { signToken, validToken } from "./signed-links";
import { currentUserFor, hasFeature, myOrgs } from "./orgs";
import { upcomingLessons } from "./lessons";
import { cfmWeekOf, usesCfm } from "./cfm";
import { eventsBetween } from "./events";
import { unreadAnswers, leaderUnread } from "./conversations";
import { unreadAnnouncements } from "./member-inbox";
import { unreadNotifications } from "./notification-log";
import { currentLessonDate, formatDate } from "./time";
import type { CurrentUser, LessonKind, Member } from "./types";

const conferenceLabelText = (kind: LessonKind) => (kind === "general_conference" ? "General Conference" : kind === "stake_conference" ? "Stake Conference" : null);

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
  const sunday = currentLessonDate(tz);
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
  const events = eventsBetween(user.id, now.toISO()!, now.plus({ days: 45 }).toISO()!, { joinedOnly: true })
    .slice(0, 3)
    .map((e) => {
      const s = DateTime.fromISO(e.starts_at).setZone(tz);
      const day = s.toISODate() === today ? "Today" : s.toISODate() === local.plus({ days: 1 }).toISODate() ? "Tomorrow" : formatDate(s.toISODate()!, "short");
      return { title: e.title, when: `${day} · ${s.toFormat("h:mm a")}`, path: `/calendar/${e.id}?org=${e.org_id}` };
    });
  const event = events[0] ?? null;
  const unread = unreadAnswers(user.id) + unreadAnnouncements(user.id) + leaderUnread(user.id) + unreadNotifications(user.id);
  return { ward: user.ward.name, lesson, study, event, events, unread };
}
