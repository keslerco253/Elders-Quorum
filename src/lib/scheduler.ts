import fs from "fs";
import path from "path";
import { DateTime } from "luxon";
import { db, DATA_DIR } from "./db";
import { audienceMembers, claimOnce, notify, recipientById, type Recipient } from "./notify";
import { lessonOn } from "./lessons";
import { ensureCfmLessons, usesCfm } from "./cfm";
import { getNotes } from "./lesson-notes";
import { respondPath } from "./teaching";
import { formatDate, formatDateTime } from "./time";
import type { PushPayload } from "./push";
import type { EventRow } from "./types";
import { eventAudience } from "./events";
import { daysBetween, dueForDate, dueForStart, ownSettings, type ReminderChannel } from "./reminder-prefs";
import { hasFeature, homeOf } from "./orgs";
import { runRetention } from "./retention";
import { extendAllSeries } from "./event-series";
import { upcomingVisits, visitorIds, whenText } from "./planned-visits";
import { VISIT_TYPES } from "./visits";
import { firstName } from "./names";
import { renderTemplate } from "./templates";
import { guestRemindersDue, sendGuestReminder } from "./guest-signups";
import { deliverHeldReplies } from "./sms-inbound";
import { joinNames } from "./invite-text";
import { withOrg } from "./org-cookie";
import { recordsToReview } from "./meetings";
import { fillRegularTeachers } from "./regular-teachers";
import { todoChannels } from "./personal-todos";
import { challengeMemberIds, scoreboard } from "./challenges";

/** An organization the scheduler sends reminders for, with its ward's time zone. */
interface OrgCtx {
  id: number;
  kind?: "ward" | "group";
  timezone: string;
  label: string;
  hidden_features: string;
}

export interface DueNotification {
  key: string;
  recipients: Recipient[];
  payload: PushPayload;
  /** A member's own reminder: sent as a text or as an app notification. */
  only?: ReminderChannel[];
}

// Lesson reminders: Sunday 7 PM for the next Sunday's lesson, and Saturday 8 AM
// for tomorrow's. If the server was off at that moment it still sends within a
// few hours, but never twice.
const LESSON_WINDOWS = [
  { weekday: 7, hour: 19, untilHour: 24, daysAhead: 7, tag: "sun" },
  { weekday: 6, hour: 8, untilHour: 14, daysAhead: 1, tag: "sat" },
];

/** Where the teacher's notes for the class stand. */
function teacherNotesLine(lessonId: number) {
  const n = getNotes(lessonId);
  if (n?.published_body && n.status !== "pending") return "Your notes are posted for everyone to read.";
  if (n?.status === "pending") return "Your notes are waiting for the presidency to approve them.";
  if (n?.status === "rejected") return "The presidency sent your notes back with a comment. Tap to see it.";
  return "Want to share notes with everyone before Sunday? Tap to add them on the lesson page.";
}

function lessonReminders(org: OrgCtx, now: DateTime): DueNotification[] {
  const local = now.setZone(org.timezone);
  const out: DueNotification[] = [];
  for (const w of LESSON_WINDOWS) {
    if (local.weekday !== w.weekday || local.hour < w.hour || local.hour >= w.untilHour) continue;
    const date = local.plus({ days: w.daysAhead }).toISODate()!;
    const lesson = lessonOn(org.id, date);
    if (!lesson) continue;
    const when = w.tag === "sat" ? "Tomorrow" : "This Sunday";
    // Sunday School follows Come, Follow Me: Sunday evening, the coming week's reading; on
    // Saturday, a reminder about class only when a teacher is set for it.
    const cfm = usesCfm(org) && lesson.kind === "talk" && !!lesson.cfm_auto;
    let payload: PushPayload;
    if (cfm && w.tag === "sat" && !lesson.teacher_id) continue;
    if (cfm && w.tag === "sun") {
      payload = { ...renderTemplate(org.id, "cfm_week", { reading: lesson.title, lesson_title: lesson.speaker }), url: `/lessons/${lesson.id}` };
    } else if (lesson.kind !== "talk") {
      const conf = lesson.kind === "general_conference" ? "General Conference" : "Stake Conference";
      payload = { ...renderTemplate(org.id, "lesson_conference", { day: when, conference: conf, org: org.label, this_week: w.tag === "sat" ? "tomorrow" : "this week" }), url: `/lessons/${lesson.id}` };
    } else {
      payload = {
        ...renderTemplate(org.id, "lesson_reminder", { day: when, lesson_title: lesson.title, speaker: lesson.topic ? "" : lesson.speaker, teacher: lesson.teacher_name }),
        url: `/lessons/${lesson.id}`,
      };
    }
    // The teacher gets their own reminder instead of the general one.
    const teacher = lesson.kind === "talk" ? recipientById(lesson.teacher_id, org.id) : undefined;
    // Members who set their own lesson reminders (or none) get those instead.
    const own = ownSettings("lessons");
    const everyone = audienceMembers(org.id, "everyone").filter((r) => r.id !== teacher?.id && !own.has(r.id));
    out.push({ key: `lesson-${w.tag}:${org.id}:${date}`, recipients: everyone, payload });
    if (teacher) {
      const confirmed = !!lesson.teacher_confirmed_at;
      const about = [lesson.title ? `"${lesson.title}"${lesson.speaker && !lesson.topic ? ` by ${lesson.speaker}` : ""}.` : "", teacherNotesLine(lesson.id)].filter(Boolean).join(" ");
      out.push({
        key: `lesson-teacher-${w.tag}:${org.id}:${date}:${teacher.id}`,
        recipients: [teacher],
        payload: confirmed
          ? {
              title: w.tag === "sat" ? "You're teaching tomorrow" : "You're teaching this Sunday",
              body: `${about} Thanks for confirming. Plans changed? Tap to let us know.`,
              url: respondPath(lesson.id, teacher.id),
              linkLabel: "Open",
              textBody: `${about} Thanks for confirming. Plans changed? Reply CANT and a reason.`,
            }
          : {
              title: w.tag === "sat" ? "You're teaching tomorrow" : "You're teaching this Sunday",
              body: `${about} Still planning to teach? Tap to let us know either way.`,
              url: respondPath(lesson.id, teacher.id),
              linkLabel: "Reply: teaching or not",
              textBody: `${about} Reply TEACH if you're still teaching, or CANT and a reason if you can't.`,
              actions: [
                { action: "teach", title: "I'll be teaching", url: respondPath(lesson.id, teacher.id, "teach") },
                { action: "cant", title: "I can't teach", url: respondPath(lesson.id, teacher.id, "cant") },
              ],
            },
      });
    }
  }
  return out;
}

/** "Today", "Tomorrow", "This Sunday" or "Next Sunday", for a lesson some days away. */
const sundayWord = (days: number) => (days === 0 ? "Today" : days === 1 ? "Tomorrow" : days <= 6 ? "This Sunday" : "Next Sunday");

/** Members' own lesson reminders (Lessons → My reminders). */
function myLessonReminders(org: OrgCtx, now: DateTime): DueNotification[] {
  const own = ownSettings("lessons");
  if (!own.size) return [];
  const local = now.setZone(org.timezone);
  const today = local.toISODate()!;
  const members = audienceMembers(org.id, "everyone").filter((r) => own.get(r.id)?.mode === "custom");
  if (!members.length) return [];
  // The Sundays a reminder could be about: today's (if it's Sunday) and the next two.
  const first = local.weekday === 7 ? local : local.plus({ days: 7 - local.weekday });
  const lessons = [0, 7, 14].map((n) => lessonOn(org.id, first.plus({ days: n }).toISODate()!)).filter((l): l is NonNullable<typeof l> => !!l);
  const out: DueNotification[] = [];
  for (const lesson of lessons) {
    const days = daysBetween(today, lesson.date);
    const cfm = usesCfm(org) && lesson.kind === "talk" && !!lesson.cfm_auto;
    const day = sundayWord(days);
    const payload: PushPayload =
      lesson.kind !== "talk"
        ? {
            ...renderTemplate(org.id, "lesson_conference", {
              day,
              conference: lesson.kind === "general_conference" ? "General Conference" : "Stake Conference",
              org: org.label,
              this_week: days === 1 ? "tomorrow" : days === 0 ? "today" : "this week",
            }),
            url: `/lessons/${lesson.id}`,
          }
        : cfm && days >= 2
          ? { ...renderTemplate(org.id, "cfm_week", { reading: lesson.title, lesson_title: lesson.speaker }), url: `/lessons/${lesson.id}` }
          : { ...renderTemplate(org.id, "lesson_reminder", { day, lesson_title: lesson.title, speaker: lesson.topic ? "" : lesson.speaker, teacher: lesson.teacher_name }), url: `/lessons/${lesson.id}` };
    for (const m of members) {
      // The teacher gets the teacher's reminders instead.
      if (lesson.kind === "talk" && m.id === lesson.teacher_id) continue;
      for (const r of own.get(m.id)!.reminders) {
        if (!dueForDate(r.when, lesson.date, local)) continue;
        out.push({ key: `lesson-mine:${org.id}:${lesson.date}:${m.id}:${r.when}:${r.channels.join("+")}`, recipients: [m], payload, only: r.channels });
      }
    }
  }
  return out;
}

function eventReminders(org: OrgCtx, now: DateTime): DueNotification[] {
  const nowIso = now.toUTC().toISO()!;
  // Every event coming up: its scheduled reminders, and members' own (Calendar → My reminders).
  const events = db().prepare("SELECT * FROM events WHERE org_id = ? AND starts_at > ? AND starts_at < ?").all(org.id, nowIso, now.plus({ days: 15 }).toUTC().toISO()) as EventRow[];
  const own = ownSettings("events");
  const out: DueNotification[] = [];
  for (const e of events) {
    const audience = eventAudience(e);
    const payload: PushPayload = {
      ...renderTemplate(org.id, "event_reminder", { event: e.title, date_time: formatDateTime(e.starts_at, org.timezone), location: e.location }),
      url: `/calendar/${e.id}`,
    };
    for (const m of audience) {
      const mine = own.get(m.id);
      if (mine?.mode !== "custom") continue;
      for (const r of mine.reminders) {
        if (dueForStart(r.when, e.starts_at, now)) out.push({ key: `event-mine:${e.id}:${e.starts_at}:${m.id}:${r.when}:${r.channels.join("+")}`, recipients: [m], payload, only: r.channels });
      }
    }
    // An event can have two reminders (e.g. a week before and a day before).
    for (const [minutes, keyPrefix] of [
      [e.reminder_minutes, "event"],
      [e.reminder2_minutes, "event2"],
    ] as const) {
      if (minutes === null || minutes === undefined) continue;
      const remindAt = DateTime.fromISO(e.starts_at, { zone: "utc" }).minus({ minutes });
      // Send once the reminder time passes, but skip it if we're more than 6 hours late.
      if (remindAt > now || now.diff(remindAt, "hours").hours > 6) continue;
      out.push({
        key: `${keyPrefix}:${e.id}:${e.starts_at}`,
        recipients: audience.filter((m) => !own.has(m.id)),
        payload,
      });
    }
  }
  return out;
}

function todoReminders(org: OrgCtx, now: DateTime): DueNotification[] {
  const local = now.setZone(org.timezone);
  if (local.hour < 8 || local.hour >= 20) return [];
  const today = local.toISODate()!;
  // Each assignment's reminders (days before it's due; 0 = the morning it's due), from 8 AM.
  const rows = db()
    .prepare(
      `SELECT t.id, t.title, t.due_date, t.reminder1_days AS r1, t.reminder2_days AS r2, m.id AS mid FROM todos t JOIN members m ON m.id = t.assignee_id
       WHERE t.org_id = ? AND t.done = 0 AND t.due_date >= ? AND t.due_date <= date(?, '+30 days') AND m.status = 'active'`,
    )
    .all(org.id, today, today) as { id: number; title: string; due_date: string; r1: number | null; r2: number | null; mid: number }[];
  const out: DueNotification[] = [];
  for (const t of rows) {
    const away = daysBetween(today, t.due_date);
    if (away !== t.r1 && away !== t.r2) continue;
    const who = recipientById(t.mid, org.id);
    if (!who) continue;
    out.push({
      // (The day-before and day-of keys are the ones used before reminders could be chosen.)
      key: away === 0 ? `todo-due:${t.id}:${t.due_date}` : away === 1 ? `todo-pre:${t.id}:${t.due_date}` : `todo-r${away}:${t.id}:${t.due_date}`,
      recipients: [who],
      payload: {
        title: away === 0 ? "Assignment due today" : away === 1 ? "Assignment due tomorrow" : `Assignment due in ${away} days`,
        body: `${t.title} (due ${formatDate(t.due_date, "short")})`,
        url: withOrg(`/assignments/${t.id}`, org.id),
      },
    });
  }
  return out;
}

/**
 * Once a month (the 1st, from 9 AM), the president (or the whole presidency if no one
 * has that calling) hears about meeting notes and finished assignments due for review:
 * keep them only as long as they're needed.
 */
function reviewReminders(org: OrgCtx, now: DateTime): DueNotification[] {
  const local = now.setZone(org.timezone);
  if (local.day !== 1 || local.hour < 9 || local.hour >= 20) return [];
  const n = recordsToReview(org.id, local.toISODate()!).length;
  if (!n) return [];
  const presidents = (
    db()
      .prepare("SELECT om.member_id FROM org_members om JOIN members m ON m.id = om.member_id WHERE om.org_id = ? AND om.role = 'presidency' AND om.calling IN ('president','bishop') AND m.status = 'active'")
      .all(org.id) as { member_id: number }[]
  ).map((r) => recipientById(r.member_id, org.id));
  const to = presidents.filter((r): r is Recipient => !!r);
  return [
    {
      key: `records-review:${org.id}:${local.toFormat("yyyy-LL")}`,
      recipients: to.length ? to : audienceMembers(org.id, "presidency"),
      payload: {
        title: "Presidency records to review",
        body: `${n} record${n === 1 ? " is" : "s are"} due for review (meeting notes, finished assignments). Keep what's still needed and delete the rest.`,
        url: withOrg("/admin/meetings/review", org.id),
      },
    },
  ];
}

/** How long before a visit its reminder goes out. */
export const VISIT_REMINDER_HOURS = 3;

/**
 * A planned visit's reminder, the same day and at least 3 hours ahead, to the
 * presidency and whoever is going, and to the member being visited (if they were
 * told about it). A visit before 10 AM is reminded at 8 PM the evening before
 * (not before 7 AM); one with no time set, at 8 AM that day.
 */
function visitReminders(org: OrgCtx, now: DateTime): DueNotification[] {
  const local = now.setZone(org.timezone);
  const out: DueNotification[] = [];
  for (const p of upcomingVisits(org.id)) {
    const day = DateTime.fromISO(p.date, { zone: org.timezone });
    const start = p.time ? DateTime.fromISO(`${p.date}T${p.time}`, { zone: org.timezone }) : day.set({ hour: 20 });
    let due = p.time ? start.minus({ hours: VISIT_REMINDER_HOURS }) : day.set({ hour: 8 });
    if (due.hour < 7 || due < day) due = day.minus({ days: 1 }).set({ hour: 20 });
    if (local < due || local >= start) continue;
    const when = whenText(p.date, p.time);
    const kind = VISIT_TYPES[p.type]?.toLowerCase() ?? p.type;
    const today = due.hasSame(day, "day");
    const leaders = new Set([...audienceMembers(org.id, "presidency").map((r) => r.id), ...visitorIds(p)]);
    leaders.delete(p.member_id);
    out.push({
      key: `visit-rem:${p.id}:${p.date}:${p.time ?? ""}`,
      recipients: [...leaders].map((id) => recipientById(id, org.id)).filter((r): r is Recipient => !!r),
      payload: {
        ...renderTemplate(org.id, "visit_reminder_leaders", { member: p.member_name, day: today ? "today" : "tomorrow", date_time: when, visit_type: kind, visitors: p.visitors }),
        url: "/admin/visits",
      },
    });
    if (p.member_told) {
      const member = recipientById(p.member_id, org.id);
      const leaders = org.kind === "ward" ? "bishopric" : `${org.label} presidency`;
      const msg = renderTemplate(org.id, "visit_reminder_member", {
        first_name: firstName(p.member_name),
        visitors: joinNames(p.visitors?.split(", ") ?? []),
        leaders: `the ${leaders}`,
        visit_kind: p.type === "phone" ? "call you" : p.type === "church" ? "meet with you at church" : "visit you in your home",
        day: today ? "today" : "tomorrow",
        time: p.time ? DateTime.fromISO(p.time).toFormat("h:mm a") : "",
        is_are: (p.visitors ?? "").includes(",") ? "are" : "is",
      });
      if (member)
        out.push({
          key: `visit-rem-m:${p.id}:${p.date}:${p.time ?? ""}`,
          recipients: [member],
          payload: {
            ...msg,
            url: "/",
            // Just the words, signed, like a personal message; a texted reply goes to the presidency.
            personal: { from: org.kind === "ward" ? "The bishopric" : `The ${leaders}` },
            asMember: true,
          },
        });
    }
  }
  return out;
}

/**
 * People who signed up for a service opportunity get its reminders (two, each a number
 * of days before its date; a week and a day before unless changed), from 8 AM, or
 * later that day if the server was off. Opportunities without a date get none.
 */
function signupReminders(org: OrgCtx, now: DateTime): DueNotification[] {
  const local = now.setZone(org.timezone);
  // The scheduled ones go out from 8 AM; members' own (Service → My reminders) at the time they chose.
  const scheduledHours = local.hour >= 8 && local.hour < 20;
  const own = ownSettings("service");
  if (!scheduledHours && !own.size) return [];
  const today = local.toISODate()!;
  const rows = db()
    .prepare(
      `SELECT s.id, s.title, s.date, s.time, s.reminder1_days, s.reminder2_days, e.member_id, group_concat(sl.label, ', ') AS slots
       FROM signups s JOIN signup_slots sl ON sl.signup_id = s.id JOIN signup_entries e ON e.slot_id = sl.id JOIN members m ON m.id = e.member_id
       WHERE s.org_id = ? AND s.date >= ? AND s.date <= date(?, '+14 days') AND m.status = 'active'
       GROUP BY s.id, e.member_id`,
    )
    .all(org.id, today, today) as { id: number; title: string; date: string; time: string | null; reminder1_days: number | null; reminder2_days: number | null; member_id: number; slots: string }[];
  const out: DueNotification[] = [];
  const whenWord = (days: number) => (days === 0 ? "Today" : days === 1 ? "Tomorrow" : days === 7 ? "Next week" : days === 14 ? "In two weeks" : `In ${days} days`);
  for (const r of rows) {
    const daysAway = Math.round(DateTime.fromISO(r.date).diff(DateTime.fromISO(today), "days").days);
    const mine = own.get(r.member_id);
    if (mine) {
      const who = mine.mode === "custom" ? recipientById(r.member_id, org.id) : undefined;
      // Like events: counted back from when it starts (9 AM when no time is set).
      const starts = DateTime.fromISO(`${r.date}T${r.time ?? "09:00"}`, { zone: org.timezone }).toUTC().toISO()!;
      for (const rem of who ? mine.reminders : []) {
        if (!dueForStart(rem.when, starts, now)) continue;
        out.push({
          key: `signup-mine:${r.id}:${r.date}:${r.time ?? ""}:${r.member_id}:${rem.when}:${rem.channels.join("+")}`,
          recipients: [who!],
          payload: { ...renderTemplate(org.id, "service_reminder", { when: whenWord(daysAway), title: r.title, slots: r.slots, date: formatDate(r.date, "short") }), url: `/signups/${r.id}` },
          only: rem.channels,
        });
      }
      continue;
    }
    if (!scheduledHours) continue;
    for (const [days, tag] of [
      [r.reminder1_days, "r1"],
      [r.reminder2_days, "r2"],
    ] as const) {
      if (days === null || days !== daysAway) continue;
      const who = recipientById(r.member_id, org.id);
      if (!who) continue;
      const when = whenWord(days);
      out.push({
        key: `signup-${tag}:${r.id}:${r.date}:${r.member_id}`,
        recipients: [who],
        payload: {
          ...renderTemplate(org.id, "service_reminder", { when, title: r.title, slots: r.slots, date: formatDate(r.date, "short") }),
          url: `/signups/${r.id}`,
        },
      });
    }
  }
  return out;
}

/**
 * Members' own to-dos: their reminders (days before it's due; 0 = the morning it's due),
 * from 8 AM in their ward's time zone, only the ways they chose (texts only for
 * presidency members).
 */
function personalTodoReminders(now: DateTime): DueNotification[] {
  const rows = db()
    .prepare(
      `SELECT t.id, t.member_id, t.title, t.due_date, t.reminder1_days AS r1, t.reminder2_days AS r2, t.channels,
         (SELECT w.timezone FROM ward_members wm JOIN wards w ON w.id = wm.ward_id WHERE wm.member_id = t.member_id ORDER BY w.id LIMIT 1) AS tz
       FROM personal_todos t JOIN members m ON m.id = t.member_id
       WHERE t.done = 0 AND t.due_date IS NOT NULL AND t.due_date >= date('now', '-1 day') AND t.due_date <= date('now', '+31 days') AND m.status = 'active'`,
    )
    .all() as { id: number; member_id: number; title: string; due_date: string; r1: number | null; r2: number | null; channels: string; tz: string | null }[];
  const out: DueNotification[] = [];
  for (const t of rows) {
    const local = now.setZone(t.tz ?? "America/Boise");
    if (local.hour < 8 || local.hour >= 20) continue;
    const away = daysBetween(local.toISODate()!, t.due_date);
    if (away < 0 || (away !== t.r1 && away !== t.r2)) continue;
    const home = homeOf(t.member_id);
    const who = home.orgId ? recipientById(t.member_id, home.orgId) : undefined;
    if (!who) continue;
    out.push({
      key: `ptodo:${t.id}:${t.due_date}:${away}`,
      recipients: [who],
      payload: {
        title: away === 0 ? "Your to-do is due today" : away === 1 ? "Your to-do is due tomorrow" : `Your to-do is due in ${away} days`,
        body: `${t.title} (due ${formatDate(t.due_date, "short")})`,
        url: `/assignments/mine/${t.id}`,
      },
      only: todoChannels(t.member_id, t.channels),
    });
  }
  return out;
}

/** The day after a challenge ends, everyone on its teams hears the final scores. */
function challengeResults(now: DateTime): DueNotification[] {
  const out: DueNotification[] = [];
  const rows = db()
    .prepare("SELECT c.id, c.title, c.ends_on, w.timezone FROM challenges c JOIN wards w ON w.id = c.ward_id WHERE c.ends_on >= ? AND c.ends_on <= ?")
    .all(now.minus({ days: 3 }).toISODate(), now.toISODate()) as { id: number; title: string; ends_on: string; timezone: string }[];
  for (const c of rows) {
    const local = now.setZone(c.timezone);
    if (local.toISODate()! <= c.ends_on || local.hour < 9 || local.hour >= 20) continue;
    const board = scoreboard(c.id);
    const [first, second] = board;
    if (!first) continue;
    const tied = !!second && second.points === first.points;
    const recipients = challengeMemberIds(c.id)
      .map((id) => {
        const home = homeOf(id);
        return home.orgId ? recipientById(id, home.orgId) : undefined;
      })
      .filter((r): r is Recipient => !!r);
    const fmt = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));
    out.push({
      key: `challenge-end:${c.id}:${c.ends_on}`,
      recipients,
      payload: {
        title: tied ? `${c.title}: it's a tie!` : `${c.title}: ${first.team.name} wins! 🏆`,
        body: `Final scores: ${board.map((b) => `${b.team.name} ${fmt(b.points)}`).join(", ")}. Thanks, everyone!`,
        url: `/plans/challenges/${c.id}`,
      },
    });
  }
  return out;
}

/**
 * Paid texting: two weeks before a ward's paid-through date the site owner is
 * reminded; the day after, its texting turns off and they're told.
 */
function textingPaidNotices(now: DateTime): DueNotification[] {
  const today = now.setZone("America/Boise").toISODate()!;
  const soon = now.setZone("America/Boise").plus({ days: 14 }).toISODate()!;
  const wards = db().prepare("SELECT id, name, texting_paid_through AS through FROM wards WHERE texting_enabled = 1 AND texting_paid_through IS NOT NULL").all() as {
    id: number;
    name: string;
    through: string;
  }[];
  if (!wards.length) return [];
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const owners = (db().prepare("SELECT id FROM members WHERE status = 'active' AND (is_site_owner = 1 OR (? <> '' AND lower(email) = ? AND email_verified_at IS NOT NULL))").all(ownerEmail, ownerEmail) as { id: number }[])
    .map((o) => {
      const org = db().prepare("SELECT om.org_id FROM org_members om JOIN orgs x ON x.id = om.org_id WHERE om.member_id = ? ORDER BY x.kind = 'ward' DESC LIMIT 1").get(o.id) as { org_id: number } | undefined;
      return org ? recipientById(o.id, org.org_id) : undefined;
    })
    .filter((r): r is Recipient => !!r);
  const out: DueNotification[] = [];
  for (const w of wards) {
    if (w.through < today) {
      db().prepare("UPDATE wards SET texting_enabled = 0 WHERE id = ?").run(w.id);
      out.push({ key: `texting-ended:${w.id}:${w.through}`, recipients: owners, payload: { title: `Texting ended for ${w.name}`, body: `It was paid through ${formatDate(w.through, "short")}, so texting is off now. Members get email and app notifications instead.`, url: "/site" } });
    } else if (w.through <= soon) {
      out.push({ key: `texting-ending:${w.id}:${w.through}`, recipients: owners, payload: { title: `${w.name}: texting paid through ${formatDate(w.through, "short")}`, body: "It turns off the day after unless you set a new date (Admin → Site owner → Texting & billing).", url: "/site" } });
    }
  }
  return out;
}

export function collectDue(now: DateTime = DateTime.utc()): DueNotification[] {
  const orgs = db()
    .prepare("SELECT o.id, o.kind, w.timezone, CASE WHEN o.kind = 'ward' THEN w.name ELSE o.name END AS label, o.hidden_features FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE o.active = 1")
    .all() as OrgCtx[];
  // Sunday School's lessons fill from Come, Follow Me as new weeks come up.
  for (const o of orgs) if (usesCfm(o) && hasFeature(o, "lessons")) ensureCfmLessons(o.id, now.setZone(o.timezone).toISODate()!);
  // Regular teachers go on new lessons as they're added.
  for (const o of orgs) if (hasFeature(o, "lessons")) fillRegularTeachers(o.id, now.setZone(o.timezone).toISODate()!);
  return [
    ...textingPaidNotices(now),
    ...personalTodoReminders(now),
    ...challengeResults(now),
    ...orgs.flatMap((o) => [
    ...(hasFeature(o, "lessons") ? lessonReminders(o, now) : []),
    ...(hasFeature(o, "lessons") ? myLessonReminders(o, now) : []),
    ...eventReminders(o, now),
    ...(hasFeature(o, "todos") ? todoReminders(o, now) : []),
    ...(hasFeature(o, "todos") ? reviewReminders(o, now) : []),
    ...(hasFeature(o, "visits") ? visitReminders(o, now) : []),
    ...(hasFeature(o, "signups") ? signupReminders(o, now) : []),
    ]),
  ];
}

/**
 * Nightly copy of the database (keeping the last 30) plus any uploaded PDFs.
 * BACKUP_DIR points at a folder you can see on the host computer.
 */
export async function backupIfDue(now: DateTime = DateTime.local()) {
  if (now.hour < 2) return;
  const dir = process.env.BACKUP_DIR || path.join(DATA_DIR, "backups");
  const file = path.join(dir, `app-${now.toISODate()}.db`);
  if (fs.existsSync(file)) return;
  fs.mkdirSync(dir, { recursive: true });
  await db().backup(file);
  const old = fs.readdirSync(dir).filter((f) => /^app-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -30);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  const uploads = path.join(DATA_DIR, "uploads");
  if (fs.existsSync(uploads)) {
    fs.mkdirSync(path.join(dir, "uploads"), { recursive: true });
    for (const f of fs.readdirSync(uploads)) {
      const dest = path.join(dir, "uploads", f);
      if (!fs.existsSync(dest)) fs.copyFileSync(path.join(uploads, f), dest);
    }
  }
  console.log(`[backup] wrote ${file}`);
}

let running = false;

export async function tick(now: DateTime = DateTime.utc()) {
  if (running) return;
  running = true;
  try {
    for (const n of collectDue(now)) {
      if (!claimOnce(n.key)) continue;
      const res = await notify(n.recipients, n.payload, { only: n.only });
      console.log(`[scheduler] ${n.key}: ${res.push} push, ${res.email} email`);
    }
    // Texted replies held while asking which organization they're for.
    await deliverHeldReplies();
    // People without an account who signed up for service from a public link.
    for (const r of guestRemindersDue(now.toJSDate())) {
      if (!claimOnce(r.key)) continue;
      await sendGuestReminder(r);
    }
    await backupIfDue();
    // Keep repeating events filled a year ahead.
    if (claimOnce(`series:${DateTime.local().toISODate()}`)) {
      const added = extendAllSeries();
      if (added) console.log(`[series] added ${added} event dates`);
    }
    if (claimOnce(`retention:${DateTime.local().toISODate()}`)) {
      const removed = Object.entries(runRetention()).filter(([, n]) => n > 0);
      if (removed.length) console.log("[retention] deleted", Object.fromEntries(removed));
    }
    db().prepare("DELETE FROM sent_notifications WHERE sent_at < datetime('now', '-60 days')").run();
  } catch (err) {
    console.error("[scheduler] error", err);
  } finally {
    running = false;
  }
}

const g = globalThis as unknown as { __eqScheduler?: NodeJS.Timeout };

export function startScheduler() {
  if (g.__eqScheduler) return;
  g.__eqScheduler = setInterval(() => void tick(), 60_000);
  setTimeout(() => void tick(), 5_000);
  console.log("[scheduler] started");
}
