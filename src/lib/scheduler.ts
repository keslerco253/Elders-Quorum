import fs from "fs";
import path from "path";
import { DateTime } from "luxon";
import { db, DATA_DIR } from "./db";
import { audienceMembers, claimOnce, notify, recipientById, type Recipient } from "./notify";
import { lessonOn } from "./lessons";
import { getNotes } from "./lesson-notes";
import { respondPath } from "./teaching";
import { formatDate, formatDateTime } from "./time";
import type { PushPayload } from "./push";
import type { EventRow } from "./types";
import { hasFeature } from "./orgs";
import { runRetention } from "./retention";
import { extendAllSeries } from "./event-series";
import { upcomingVisits, visitorIds, whenText } from "./planned-visits";
import { VISIT_TYPES } from "./visits";

/** An organization the scheduler sends reminders for, with its ward's time zone. */
interface OrgCtx {
  id: number;
  timezone: string;
  label: string;
  hidden_features: string;
}

export interface DueNotification {
  key: string;
  recipients: Recipient[];
  payload: PushPayload;
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
    let payload: PushPayload;
    if (lesson.kind !== "talk") {
      const conf = lesson.kind === "general_conference" ? "General Conference" : "Stake Conference";
      payload = { title: `${when}: ${conf}`, body: `No ${org.label} lesson ${w.tag === "sat" ? "tomorrow" : "this week"}. We hope to see you at ${conf}.`, url: `/lessons/${lesson.id}` };
    } else {
      payload = {
        title: `${when}'s lesson${lesson.title ? `: ${lesson.title}` : ""}`,
        body: [lesson.speaker && `By ${lesson.speaker}.`, lesson.teacher_name && `Taught by ${lesson.teacher_name}.`, "Tap to read the talk and share your thoughts."].filter(Boolean).join(" "),
        url: `/lessons/${lesson.id}`,
      };
    }
    // The teacher gets their own reminder instead of the general one.
    const teacher = lesson.kind === "talk" ? recipientById(lesson.teacher_id, org.id) : undefined;
    const everyone = audienceMembers(org.id, "everyone").filter((r) => r.id !== teacher?.id);
    out.push({ key: `lesson-${w.tag}:${org.id}:${date}`, recipients: everyone, payload });
    if (teacher) {
      const confirmed = !!lesson.teacher_confirmed_at;
      const about = [lesson.title ? `"${lesson.title}"${lesson.speaker ? ` by ${lesson.speaker}` : ""}.` : "", teacherNotesLine(lesson.id)].filter(Boolean).join(" ");
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

function eventReminders(org: OrgCtx, now: DateTime): DueNotification[] {
  const nowIso = now.toUTC().toISO()!;
  const events = db()
    .prepare("SELECT * FROM events WHERE org_id = ? AND (reminder_minutes IS NOT NULL OR reminder2_minutes IS NOT NULL) AND starts_at > ? AND starts_at < ?")
    .all(org.id, nowIso, now.plus({ days: 15 }).toUTC().toISO()) as EventRow[];
  const out: DueNotification[] = [];
  for (const e of events) {
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
        recipients: audienceMembers(org.id, e.presidency_only ? "admins" : "everyone"),
        payload: { title: `Reminder: ${e.title}`, body: `${formatDateTime(e.starts_at, org.timezone)}${e.location ? ` at ${e.location}` : ""}`, url: `/calendar/${e.id}` },
      });
    }
  }
  return out;
}

function todoReminders(org: OrgCtx, now: DateTime): DueNotification[] {
  const local = now.setZone(org.timezone);
  if (local.hour < 8 || local.hour >= 20) return [];
  const today = local.toISODate()!;
  const tomorrow = local.plus({ days: 1 }).toISODate()!;
  const rows = db()
    .prepare(
      `SELECT t.id, t.title, t.due_date, m.id AS mid FROM todos t JOIN members m ON m.id = t.assignee_id
       WHERE t.org_id = ? AND t.done = 0 AND t.due_date IN (?, ?) AND m.status = 'active'`,
    )
    .all(org.id, today, tomorrow) as { id: number; title: string; due_date: string; mid: number }[];
  return rows.map((t) => ({
    key: `todo-${t.due_date === today ? "due" : "pre"}:${t.id}:${t.due_date}`,
    recipients: [recipientById(t.mid, org.id)].filter((r): r is Recipient => !!r),
    payload: { title: t.due_date === today ? "Assignment due today" : "Assignment due tomorrow", body: `${t.title} (due ${formatDate(t.due_date, "short")})`, url: "/admin/todos" },
  }));
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
        title: `Visit ${today ? "today" : "tomorrow"}: ${p.member_name}`,
        body: `${when} (${kind})${p.visitors ? `, with ${p.visitors}` : ""}.${p.invite_status === "accepted" ? " They said yes." : ""}`,
        url: "/admin/visits",
      },
    });
    if (p.member_told) {
      const member = recipientById(p.member_id, org.id);
      if (member)
        out.push({
          key: `visit-rem-m:${p.id}:${p.date}:${p.time ?? ""}`,
          recipients: [member],
          payload: {
            title: `Reminder: visit ${today ? "today" : "tomorrow"}`,
            body: `${p.visitors ?? `Your ${org.label} leaders`} ${p.type === "phone" ? "will call you" : p.type === "church" ? "will meet with you at church" : (p.visitors ?? "").includes(",") ? "plan to visit you" : "plans to visit you"} ${when}.`,
            url: "/",
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
  if (local.hour < 8 || local.hour >= 20) return [];
  const today = local.toISODate()!;
  const rows = db()
    .prepare(
      `SELECT s.id, s.title, s.date, s.reminder1_days, s.reminder2_days, e.member_id, group_concat(sl.label, ', ') AS slots
       FROM signups s JOIN signup_slots sl ON sl.signup_id = s.id JOIN signup_entries e ON e.slot_id = sl.id JOIN members m ON m.id = e.member_id
       WHERE s.org_id = ? AND s.date >= ? AND s.date <= date(?, '+14 days') AND m.status = 'active'
       GROUP BY s.id, e.member_id`,
    )
    .all(org.id, today, today) as { id: number; title: string; date: string; reminder1_days: number | null; reminder2_days: number | null; member_id: number; slots: string }[];
  const out: DueNotification[] = [];
  for (const r of rows) {
    const daysAway = Math.round(DateTime.fromISO(r.date).diff(DateTime.fromISO(today), "days").days);
    for (const [days, tag] of [
      [r.reminder1_days, "r1"],
      [r.reminder2_days, "r2"],
    ] as const) {
      if (days === null || days !== daysAway) continue;
      const who = recipientById(r.member_id, org.id);
      if (!who) continue;
      const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days === 7 ? "Next week" : days === 14 ? "In two weeks" : `In ${days} days`;
      out.push({
        key: `signup-${tag}:${r.id}:${r.date}:${r.member_id}`,
        recipients: [who],
        payload: {
          title: `${when}: ${r.title}`,
          body: `You signed up for ${r.slots} on ${formatDate(r.date, "short")}. Thank you for serving!`,
          url: `/signups/${r.id}`,
        },
      });
    }
  }
  return out;
}

export function collectDue(now: DateTime = DateTime.utc()): DueNotification[] {
  const orgs = db()
    .prepare("SELECT o.id, w.timezone, CASE WHEN o.kind = 'ward' THEN w.name ELSE o.name END AS label, o.hidden_features FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE o.active = 1")
    .all() as OrgCtx[];
  return orgs.flatMap((o) => [
    ...(hasFeature(o, "lessons") ? lessonReminders(o, now) : []),
    ...eventReminders(o, now),
    ...(hasFeature(o, "todos") ? todoReminders(o, now) : []),
    ...(hasFeature(o, "visits") ? visitReminders(o, now) : []),
    ...(hasFeature(o, "signups") ? signupReminders(o, now) : []),
  ]);
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
      const res = await notify(n.recipients, n.payload);
      console.log(`[scheduler] ${n.key}: ${res.push} push, ${res.email} email`);
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
