import { db } from "./db";

// When an organization's automatic reminders go out (Admin → Settings → Reminder times).
// The defaults are the times the app has always used.

/** A lesson reminder: days before the Sunday (0 = Sunday morning) at a time (HH:MM). */
export interface LessonWhen {
  days: number;
  time: string;
}

export interface ReminderSettings {
  /** To everyone (except the teacher), for the coming lesson. Up to two; empty for none. */
  lesson: LessonWhen[];
  /** To the teacher ("You're teaching…"). Up to two; empty for none. */
  teacher: LessonWhen[];
  /** Hours before a planned visit (to the presidency, visitors and the member). 0 for none. */
  visitHours: number;
  /** Hour of the day (0-23) service and assignment reminders start going out. */
  morningHour: number;
  /** Minutes before a scheduled presidency meeting. 0 for none. */
  meetingMinutes: number;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  lesson: [
    { days: 7, time: "19:00" },
    { days: 1, time: "08:00" },
  ],
  teacher: [
    { days: 7, time: "19:00" },
    { days: 1, time: "08:00" },
  ],
  visitHours: 3,
  morningHour: 8,
  meetingMinutes: 60,
};

/** Days before a Sunday, as the day it falls on. */
export const LESSON_DAYS: [number, string][] = [
  [7, "The Sunday before"],
  [6, "Monday"],
  [5, "Tuesday"],
  [4, "Wednesday"],
  [3, "Thursday"],
  [2, "Friday"],
  [1, "Saturday"],
  [0, "Sunday morning"],
];

export const VISIT_HOURS = [1, 2, 3, 4, 6, 12, 24];
export const MEETING_MINUTES: [number, string][] = [
  [0, "No reminder"],
  [15, "15 minutes before"],
  [30, "30 minutes before"],
  [60, "1 hour before"],
  [120, "2 hours before"],
  [1440, "1 day before"],
];

const validWhen = (w: unknown): w is LessonWhen =>
  !!w && typeof w === "object" && Number.isInteger((w as LessonWhen).days) && (w as LessonWhen).days >= 0 && (w as LessonWhen).days <= 7 && /^\d{2}:\d{2}$/.test(String((w as LessonWhen).time));

/** An organization's reminder times (defaults for anything not set). */
export function reminderSettings(orgId: number): ReminderSettings {
  const raw = (db().prepare("SELECT value FROM app_settings WHERE key = ?").get(`reminders:${orgId}`) as { value: string } | undefined)?.value;
  let saved: Partial<ReminderSettings> = {};
  try {
    saved = raw ? (JSON.parse(raw) as Partial<ReminderSettings>) : {};
  } catch {
    saved = {};
  }
  const num = (v: unknown, ok: (n: number) => boolean, d: number) => (typeof v === "number" && ok(v) ? v : d);
  return {
    lesson: Array.isArray(saved.lesson) ? saved.lesson.filter(validWhen).slice(0, 2) : DEFAULT_REMINDERS.lesson,
    teacher: Array.isArray(saved.teacher) ? saved.teacher.filter(validWhen).slice(0, 2) : DEFAULT_REMINDERS.teacher,
    visitHours: num(saved.visitHours, (n) => n === 0 || VISIT_HOURS.includes(n), DEFAULT_REMINDERS.visitHours),
    morningHour: num(saved.morningHour, (n) => Number.isInteger(n) && n >= 5 && n <= 12, DEFAULT_REMINDERS.morningHour),
    meetingMinutes: num(saved.meetingMinutes, (n) => MEETING_MINUTES.some(([m]) => m === n), DEFAULT_REMINDERS.meetingMinutes),
  };
}

export function saveOrgReminderSettings(orgId: number, s: ReminderSettings) {
  db()
    .prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(`reminders:${orgId}`, JSON.stringify(s));
}

/** "Saturday at 8:00 AM", "The Sunday before at 7:00 PM". */
export function lessonWhenText(w: LessonWhen): string {
  const [h, m] = w.time.split(":").map(Number);
  const time = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return `${LESSON_DAYS.find(([d]) => d === w.days)?.[1] ?? `${w.days} days before`} at ${time}`;
}
