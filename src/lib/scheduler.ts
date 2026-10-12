import fs from "fs";
import path from "path";
import { DateTime } from "luxon";
import { db, DATA_DIR } from "./db";
import { audienceMembers, claimOnce, notify, type Recipient } from "./notify";
import { lessonOn } from "./lessons";
import { formatDate, formatDateTime } from "./time";
import type { PushPayload } from "./push";
import type { EventRow, Ward } from "./types";
import { runRetention } from "./retention";

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

function lessonReminders(ward: Ward, now: DateTime): DueNotification[] {
  const local = now.setZone(ward.timezone);
  const out: DueNotification[] = [];
  for (const w of LESSON_WINDOWS) {
    if (local.weekday !== w.weekday || local.hour < w.hour || local.hour >= w.untilHour) continue;
    const date = local.plus({ days: w.daysAhead }).toISODate()!;
    const lesson = lessonOn(ward.id, date);
    if (!lesson) continue;
    const when = w.tag === "sat" ? "Tomorrow" : "This Sunday";
    let payload: PushPayload;
    if (lesson.kind !== "talk") {
      const conf = lesson.kind === "general_conference" ? "General Conference" : "Stake Conference";
      payload = { title: `${when}: ${conf}`, body: `No elders quorum lesson ${w.tag === "sat" ? "tomorrow" : "this week"}. We hope to see you at ${conf}.`, url: `/lessons/${lesson.id}` };
    } else {
      payload = {
        title: `${when}'s lesson${lesson.title ? `: ${lesson.title}` : ""}`,
        body: [lesson.speaker && `By ${lesson.speaker}.`, lesson.teacher_name && `Taught by ${lesson.teacher_name}.`, "Tap to read the talk and share your thoughts."].filter(Boolean).join(" "),
        url: `/lessons/${lesson.id}`,
      };
    }
    out.push({ key: `lesson-${w.tag}:${ward.id}:${date}`, recipients: audienceMembers(ward.id, "everyone"), payload });
  }
  return out;
}

function eventReminders(ward: Ward, now: DateTime): DueNotification[] {
  const nowIso = now.toUTC().toISO()!;
  const events = db()
    .prepare("SELECT * FROM events WHERE ward_id = ? AND reminder_minutes IS NOT NULL AND starts_at > ? AND starts_at < ?")
    .all(ward.id, nowIso, now.plus({ days: 8 }).toUTC().toISO()) as EventRow[];
  const out: DueNotification[] = [];
  for (const e of events) {
    const remindAt = DateTime.fromISO(e.starts_at, { zone: "utc" }).minus({ minutes: e.reminder_minutes! });
    // Send once the reminder time passes, but skip it if we're more than 6 hours late.
    if (remindAt > now || now.diff(remindAt, "hours").hours > 6) continue;
    out.push({
      key: `event:${e.id}:${e.starts_at}`,
      recipients: audienceMembers(ward.id, e.presidency_only ? "admins" : "everyone"),
      payload: { title: `Reminder: ${e.title}`, body: `${formatDateTime(e.starts_at, ward.timezone)}${e.location ? ` at ${e.location}` : ""}`, url: `/calendar/${e.id}` },
    });
  }
  return out;
}

function todoReminders(ward: Ward, now: DateTime): DueNotification[] {
  const local = now.setZone(ward.timezone);
  if (local.hour < 8 || local.hour >= 20) return [];
  const today = local.toISODate()!;
  const tomorrow = local.plus({ days: 1 }).toISODate()!;
  const rows = db()
    .prepare(
      `SELECT t.id, t.title, t.due_date, m.id AS mid, m.email, m.display_name FROM todos t JOIN members m ON m.id = t.assignee_id
       WHERE t.ward_id = ? AND t.done = 0 AND t.due_date IN (?, ?) AND m.status = 'active'`,
    )
    .all(ward.id, today, tomorrow) as { id: number; title: string; due_date: string; mid: number; email: string | null; display_name: string }[];
  return rows.map((t) => ({
    key: `todo-${t.due_date === today ? "due" : "pre"}:${t.id}:${t.due_date}`,
    recipients: [{ id: t.mid, email: t.email, display_name: t.display_name }],
    payload: { title: t.due_date === today ? "Assignment due today" : "Assignment due tomorrow", body: `${t.title} (due ${formatDate(t.due_date, "short")})`, url: "/admin/todos" },
  }));
}

export function collectDue(now: DateTime = DateTime.utc()): DueNotification[] {
  const wards = db().prepare("SELECT id, name, timezone, join_code FROM wards").all() as Ward[];
  return wards.flatMap((w) => [...lessonReminders(w, now), ...eventReminders(w, now), ...todoReminders(w, now)]);
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
