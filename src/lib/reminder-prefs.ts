import { DateTime } from "luxon";
import { db } from "./db";

// Each member's own reminders for lessons, events and service opportunities. By
// default they get the reminders their leaders scheduled; they can set their own
// instead, each by app notification, text and/or email (up to 3 texts), or turn
// them off. Stored as a row per way.

export type ReminderKind = "lessons" | "events" | "service";
export type ReminderChannel = "push" | "text" | "email";
export type ReminderMode = "default" | "custom" | "off";

export const CHANNELS: ReminderChannel[] = ["push", "text", "email"];
export const CHANNEL_LABELS: Record<ReminderChannel, string> = { push: "App notification", text: "Text", email: "Email" };

export interface MyReminder {
  when: string;
  channels: ReminderChannel[];
}

export const MAX_TEXTS = 3;
export const MAX_REMINDERS = 10;

export const KIND_LABELS: Record<ReminderKind, string> = { lessons: "Lessons", events: "Events", service: "Service" };

/** The timings offered for each kind. Lessons: days before at a time; events and service: before the start. */
export const WHEN_OPTIONS: Record<ReminderKind, [string, string][]> = {
  lessons: [
    ["d:7@19:00", "The Sunday before, 7 PM"],
    ["d:4@19:00", "Wednesday, 7 PM"],
    ["d:2@19:00", "Friday, 7 PM"],
    ["d:1@08:00", "Saturday, 8 AM"],
    ["d:1@19:00", "Saturday, 7 PM"],
    ["d:0@07:00", "Sunday morning, 7 AM"],
  ],
  events: [
    ["m:15", "15 minutes before"],
    ["m:30", "30 minutes before"],
    ["m:60", "1 hour before"],
    ["m:120", "2 hours before"],
    ["m:180", "3 hours before"],
    ["m:1440", "1 day before"],
    ["m:2880", "2 days before"],
    ["m:10080", "1 week before"],
    ["m:20160", "2 weeks before"],
  ],
  // The same as events, counted from the start time (9 AM if there's none).
  service: [],
};

/** What "my own reminders" starts with: about what leaders usually schedule. */
export const STARTING_REMINDERS: Record<ReminderKind, MyReminder[]> = {
  lessons: [
    { when: "d:7@19:00", channels: ["push"] },
    { when: "d:1@08:00", channels: ["push"] },
  ],
  events: [{ when: "m:1440", channels: ["push"] }],
  service: [
    { when: "m:10080", channels: ["push"] },
    { when: "m:1440", channels: ["push"] },
  ],
};

/** Rows (one per way) to reminders (each with its ways), in the order first seen. */
function group(rows: { when: string; channel: ReminderChannel }[]): MyReminder[] {
  const out: MyReminder[] = [];
  for (const r of rows) {
    const found = out.find((x) => x.when === r.when);
    if (!found) out.push({ when: r.when, channels: [r.channel] });
    else if (!found.channels.includes(r.channel)) found.channels.push(r.channel);
  }
  for (const r of out) r.channels.sort((a, b) => CHANNELS.indexOf(a) - CHANNELS.indexOf(b));
  return out;
}

WHEN_OPTIONS.service = WHEN_OPTIONS.events;

export const whenLabel = (kind: ReminderKind, when: string) => WHEN_OPTIONS[kind].find(([k]) => k === when)?.[1] ?? when;

export interface ReminderSettings {
  mode: ReminderMode;
  reminders: MyReminder[];
}

export function getReminderSettings(memberId: number, kind: ReminderKind): ReminderSettings {
  const row = db().prepare("SELECT mode FROM reminder_prefs WHERE member_id = ? AND kind = ?").get(memberId, kind) as { mode: ReminderMode } | undefined;
  const rows = db().prepare("SELECT when_key AS [when], channel FROM member_reminders WHERE member_id = ? AND kind = ? ORDER BY id").all(memberId, kind) as { when: string; channel: ReminderChannel }[];
  return { mode: row?.mode ?? "default", reminders: group(rows) };
}

/**
 * Saves a member's settings for one kind. Each reminder comes by the ways ticked
 * (texts only if they can get texts, email only if they have one; none ticked
 * means an app notification). Returns an error to show, or null.
 */
export function saveReminderSettings(memberId: number, kind: ReminderKind, mode: ReminderMode, reminders: MyReminder[], can: { text: boolean; email: boolean }): string | null {
  const valid = new Set(WHEN_OPTIONS[kind].map(([k]) => k));
  const allowed = (c: ReminderChannel) => c === "push" || (c === "text" && can.text) || (c === "email" && can.email);
  const list = group(
    reminders
      .filter((r) => valid.has(r.when))
      .flatMap((r) => {
        const ways = r.channels.filter((c) => CHANNELS.includes(c) && allowed(c));
        return (ways.length ? ways : (["push"] as ReminderChannel[])).map((channel) => ({ when: r.when, channel }));
      }),
  );
  if (mode === "custom") {
    if (!list.length) return "Add at least one reminder, or choose No reminders.";
    if (list.filter((r) => r.channels.includes("text")).length > MAX_TEXTS) return `You can have up to ${MAX_TEXTS} text reminders.`;
    if (list.length > MAX_REMINDERS) return `You can have up to ${MAX_REMINDERS} reminders.`;
  }
  const d = db();
  d.transaction(() => {
    d.prepare("DELETE FROM reminder_prefs WHERE member_id = ? AND kind = ?").run(memberId, kind);
    d.prepare("DELETE FROM member_reminders WHERE member_id = ? AND kind = ?").run(memberId, kind);
    if (mode === "default") return;
    d.prepare("INSERT INTO reminder_prefs (member_id, kind, mode) VALUES (?, ?, ?)").run(memberId, kind, mode);
    if (mode === "custom") {
      const ins = d.prepare("INSERT INTO member_reminders (member_id, kind, when_key, channel) VALUES (?, ?, ?, ?)");
      for (const r of list) for (const channel of r.channels) ins.run(memberId, kind, r.when, channel);
    }
  })();
  return null;
}

/** Members with their own settings for a kind (custom or off), with their reminders. */
export function ownSettings(kind: ReminderKind): Map<number, ReminderSettings> {
  const out = new Map<number, ReminderSettings>();
  for (const r of db().prepare("SELECT member_id, mode FROM reminder_prefs WHERE kind = ?").all(kind) as { member_id: number; mode: ReminderMode }[]) {
    out.set(r.member_id, { mode: r.mode, reminders: [] });
  }
  const rows = new Map<number, { when: string; channel: ReminderChannel }[]>();
  for (const r of db().prepare("SELECT member_id, when_key, channel FROM member_reminders WHERE kind = ? ORDER BY id").all(kind) as { member_id: number; when_key: string; channel: ReminderChannel }[]) {
    rows.set(r.member_id, [...(rows.get(r.member_id) ?? []), { when: r.when_key, channel: r.channel }]);
  }
  for (const [id, list] of rows) {
    const s = out.get(id);
    if (s) s.reminders = group(list);
  }
  return out;
}

// A reminder still goes out if the server was briefly down, but not hours late.
const LATE_HOURS = 6;

/** For a date (a lesson's Sunday, a service date): is "d:N@HH:MM" due now? */
export function dueForDate(when: string, date: string, local: DateTime): boolean {
  const m = when.match(/^d:(\d+)@(\d{2}):(\d{2})$/);
  if (!m) return false;
  const at = DateTime.fromISO(date, { zone: local.zone }).minus({ days: Number(m[1]) }).set({ hour: Number(m[2]), minute: Number(m[3]) });
  return local >= at && local.diff(at, "hours").hours < LATE_HOURS;
}

/** For an event: is "m:N" (minutes before it starts) due now? */
export function dueForStart(when: string, startsAtUtc: string, now: DateTime): boolean {
  const m = when.match(/^m:(\d+)$/);
  if (!m) return false;
  const at = DateTime.fromISO(startsAtUtc, { zone: "utc" }).minus({ minutes: Number(m[1]) });
  return now >= at && now.diff(at, "hours").hours < LATE_HOURS;
}

/** Days from one date to another (dates as yyyy-mm-dd). */
export const daysBetween = (from: string, to: string) => Math.round(DateTime.fromISO(to).diff(DateTime.fromISO(from), "days").days);
