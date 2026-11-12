import Anthropic from "@anthropic-ai/sdk";
import { DateTime } from "luxon";
import { appUrl } from "./config";
import { db } from "./db";
import { homeOf } from "./orgs";
import { getWard } from "./orgs";
import { savePersonalTodo, type TodoReminder } from "./personal-todos";
import { savePersonalEvent } from "./personal-events";
import { saveUpload } from "./uploads";

// The site owner texts a photo (a wedding invitation, a flyer) to the app's texting
// number. Claude reads it, and it becomes one of their own events on their calendar (like
// + My event: its time, where, and details), with text reminders a day and three hours
// before; the photo is kept with the event.
// Needs ANTHROPIC_API_KEY on the server.

export const photoTodoConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** One date read off the picture: the event itself, or a deadline for it (an RSVP). */
interface ReadEvent {
  kind: "event" | "deadline";
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  details: string;
}

/** What Claude reads off the picture: every date on it. */
interface Reading {
  found: boolean;
  events: ReadEvent[];
  problem: string;
}

const MAX_BYTES = 8_000_000;
const CLAUDE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ClaudeType = (typeof CLAUDE_TYPES)[number];

/** A texted picture, fetched from Twilio (signed in with the account's SID and token). */
async function fetchMedia(url: string): Promise<{ data: Buffer; type: string } | null> {
  if (!/^https:\/\/api\.twilio\.com\//.test(url)) return null;
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID ?? ""}:${process.env.TWILIO_AUTH_TOKEN ?? ""}`).toString("base64");
  try {
    const res = await fetch(url, { headers: { authorization: `Basic ${auth}` }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > MAX_BYTES) return null;
    return { data, type: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() };
  } catch {
    return null;
  }
}

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean", description: "True if the picture shows at least one dated event, appointment or deadline." },
    events: {
      type: "array",
      description: "One entry per date to remember: the event itself, and separately any deadline for it (RSVP by, sign up by, pay by). Oldest first.",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["event", "deadline"], description: "event: the occasion itself. deadline: something to do by a date (an RSVP)." },
          title: { type: "string", description: "Short title, e.g. \"Darik's 1st birthday party\" or \"RSVP for Darik's 1st birthday\"." },
          date: { type: "string", description: "YYYY-MM-DD." },
          start_time: { type: "string", description: "Start time as 24-hour HH:MM, or empty (a deadline usually has none)." },
          end_time: { type: "string", description: "End time as 24-hour HH:MM, or empty." },
          location: { type: "string", description: "Address or place, as written, or empty (empty for a deadline)." },
          details: { type: "string", description: "Useful details in one or two short lines: who it's for and hosts; for a deadline, who to answer and how (name and phone number)." },
        },
        required: ["kind", "title", "date", "start_time", "end_time", "location", "details"],
        additionalProperties: false,
      },
    },
    problem: { type: "string", description: "If found is false, a short reason (e.g. 'no date on it'); else empty." },
  },
  required: ["found", "events", "problem"],
  additionalProperties: false,
} as const;

async function readPictures(pictures: { data: Buffer; type: ClaudeType }[], caption: string, today: string, tz: string, kind: "event" | "todo" = "event"): Promise<Reading | null> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    // If the model declines, the request is re-run on a fallback model chosen by the API.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system:
      (kind === "todo"
        ? "Someone texted a thing to do (and maybe a picture of it) to put on their to-do list. Give one entry per thing to do, with a short title in their words; a date and time only if they or the picture give one (found is true even with no date). "
        : "You read photos of invitations, flyers and appointment cards (or a texted description) and pull out what to put on someone's calendar: the event, and separately each deadline that goes with it (an RSVP date, a sign-up-by date). ") +
      `Today is ${today} (time zone ${tz}). When the year isn't shown, use the next date on or after today. ` +
      "The same date written twice is one entry. Several pictures are the front and back of the same thing. Use only what the pictures (and the sender's note) say; leave a field empty rather than guess.",
    messages: [
      {
        role: "user",
        content: [
          ...pictures.map((p) => ({ type: "image" as const, source: { type: "base64" as const, media_type: p.type, data: p.data.toString("base64") } })),
          { type: "text" as const, text: caption ? `The sender's note: ${caption.slice(0, 500)}` : kind === "todo" ? "What is there to do, and by when?" : "What event is this, and when?" },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as Reading;
  } catch {
    return null;
  }
}

/** The event: a text a day before and 3 hours before. */
const EVENT_REMINDERS: TodoReminder[] = [
  { when: "m:1440", push: false, text: true, email: false },
  { when: "m:180", push: false, text: true, email: false },
];
/** A deadline (all day): a text the morning before and the morning of (9 AM). */
const DEADLINE_REMINDERS: TodoReminder[] = [
  { when: "m:1440", push: false, text: true, email: false },
  { when: "m:0", push: false, text: true, email: false },
];

/** A to-do with a due date: a text the day before and when it's due (9 AM without a time). */
const TODO_REMINDERS: TodoReminder[] = [
  { when: "m:1440", push: false, text: true, email: false },
  { when: "m:0", push: false, text: true, email: false },
];

/** Pictures texted in (no keyword, or EVENT): events on the calendar. */
export const photoToEvent = (memberId: number, media: { url: string; type: string }[], caption: string) => textedItems(memberId, "event", media, caption);

/**
 * What the site owner texted in (EVENT or TODO with words, pictures, or both) put on their
 * calendar as events, or on their to-do list. Each date on it is its own item (the event,
 * and an RSVP or other deadline), each with its own reminders and the pictures. Returns
 * the text to send back: what was posted (with links), or what went wrong.
 */
export async function textedItems(memberId: number, kind: "event" | "todo", media: { url: string; type: string }[], caption: string): Promise<string> {
  const fetched = (await Promise.all(media.slice(0, 4).map((m) => fetchMedia(m.url)))).filter((f): f is { data: Buffer; type: string } => !!f);
  const pictures = fetched.filter((f): f is { data: Buffer; type: ClaudeType } => (CLAUDE_TYPES as readonly string[]).includes(f.type));
  if (media.length && !pictures.length) return "My Ward Link: I couldn't open that picture. Please send it as a photo (JPEG or PNG).";
  const home = homeOf(memberId);
  const tz = (home.orgId && getWard((db().prepare("SELECT ward_id FROM orgs WHERE id = ?").get(home.orgId) as { ward_id: number } | undefined)?.ward_id ?? 0)?.timezone) || "America/Boise";
  const today = DateTime.now().setZone(tz).toISODate()!;
  let reading: Reading | null = null;
  if (photoTodoConfigured()) {
    try {
      reading = await readPictures(pictures, caption, today, tz, kind);
    } catch (err) {
      console.error("[photo-event] reading failed", err);
    }
  }
  // A to-do in words can be added as typed, even when it can't be read for a date.
  if (!reading && kind === "todo" && !pictures.length && caption.trim())
    reading = { found: true, problem: "", events: [{ kind: "event", title: caption.trim(), date: "", start_time: "", end_time: "", location: "", details: "" }] };
  if (!reading) return photoTodoConfigured() ? "My Ward Link: I couldn't read that just now. Please try again in a minute." : "My Ward Link: reading pictures isn't set up yet (ANTHROPIC_API_KEY on the server).";
  const all = (reading.events ?? []).slice(0, 4);
  const items = kind === "todo" ? all.filter((e) => e.title.trim()) : all.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  if (!reading.found || !items.length)
    return kind === "todo"
      ? "My Ward Link: I couldn't tell what the to-do is. Text TODO and what to do, like \"TODO call the bishop Friday 3pm\"."
      : `My Ward Link: I couldn't find a date${reading.problem ? ` (${reading.problem})` : ""}. Text EVENT with the date, like "EVENT dentist Dec 3 2pm", or use + My event on the calendar.`;
  // Keep the pictures (all of them, including any Claude couldn't read), shared by everything made from them.
  const names: string[] = [];
  for (const f of fetched) {
    try {
      names.push(await saveUpload(new File([new Uint8Array(f.data)], "picture")));
    } catch {
      // Not a kind of picture that's kept.
    }
  }
  const hm = (t: string) => DateTime.fromFormat(t, "HH:mm").toFormat("h:mm a");
  const posted: string[] = [];
  for (const e of items) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null;
    const time = date && /^\d{2}:\d{2}$/.test(e.start_time) ? e.start_time : null;
    const end = time && /^\d{2}:\d{2}$/.test(e.end_time) && e.end_time > time ? e.end_time : null;
    const deadline = e.kind === "deadline";
    const title = (e.title || (deadline ? "Deadline" : "From a picture")).slice(0, 200);
    const day = date ? DateTime.fromISO(date).toFormat("ccc, LLL d") : "";
    const when = time ? `, ${hm(time)}${end ? ` to ${hm(end)}` : ""}` : "";
    if (kind === "todo") {
      const notes = [end && `Until ${hm(end)}`, e.location && `Where: ${e.location}`, e.details].filter(Boolean).join("\n").slice(0, 2000);
      const id = savePersonalTodo(memberId, null, { title, notes, due_date: date, due_time: time, reminders: date ? TODO_REMINDERS : [] });
      if (!id) continue;
      if (names.length) db().prepare("UPDATE personal_todos SET images = ? WHERE id = ?").run(JSON.stringify(names), id);
      posted.push(`${title}${date ? `, due ${day}${when} (text reminders the day before and when it's due)` : ""} ${appUrl()}/assignments/mine/${id}`);
      continue;
    }
    const id = savePersonalEvent(memberId, null, {
      title,
      notes: (e.details ?? "").slice(0, 2000),
      location: (e.location ?? "").slice(0, 300),
      date: date!,
      start_time: time ?? "00:00",
      end_time: end,
      all_day: !time,
      timezone: tz,
      reminders: deadline ? DEADLINE_REMINDERS : EVENT_REMINDERS,
    });
    if (!id) continue;
    if (names.length) db().prepare("UPDATE personal_events SET images = ? WHERE id = ?").run(JSON.stringify(names), id);
    const reminders = deadline ? "reminders the day before and that morning" : "reminders 1 day and 3 hours before";
    posted.push(`${title}, ${day}${when}${e.location ? `, ${e.location}` : ""} (text ${reminders}) ${appUrl()}/calendar/mine/${id}`);
  }
  if (!posted.length) return "My Ward Link: that couldn't be saved. Please try again.";
  const where = kind === "todo" ? "to-dos" : "calendar";
  return posted.length === 1 ? `Posted to your ${where}: ${posted[0]}` : `Posted ${posted.length} ${kind === "todo" ? "to-dos" : "events"} to your ${where}:\n${posted.map((p, n) => `${n + 1}. ${p}`).join("\n")}`;
}
