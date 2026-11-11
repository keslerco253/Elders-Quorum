import Anthropic from "@anthropic-ai/sdk";
import { DateTime } from "luxon";
import { appUrl } from "./config";
import { db } from "./db";
import { homeOf } from "./orgs";
import { getWard } from "./orgs";
import { savePersonalTodo, type TodoReminder } from "./personal-todos";
import { saveUpload } from "./uploads";

// The site owner texts a photo (a wedding invitation, a flyer) to the app's texting
// number. Claude reads it, and it becomes one of their private to-dos on that date, with
// text reminders a day and three hours before; the photo is kept with the to-do.
// Needs ANTHROPIC_API_KEY on the server.

export const photoTodoConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** What Claude reads off the picture. */
interface Reading {
  found: boolean;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  details: string;
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
    found: { type: "boolean", description: "True if the picture shows a dated event or appointment to remember." },
    title: { type: "string", description: "Short title, e.g. 'Wedding reception: Ashton Daniels & Brooke Boyle'." },
    date: { type: "string", description: "The event's date as YYYY-MM-DD, or empty if none is shown." },
    start_time: { type: "string", description: "Start time as 24-hour HH:MM, or empty if none is shown." },
    end_time: { type: "string", description: "End time as 24-hour HH:MM, or empty." },
    location: { type: "string", description: "Address or place, as written, or empty." },
    details: { type: "string", description: "Other useful details in one or two short lines (who it's for, hosts, notes), or empty." },
    problem: { type: "string", description: "If found is false, a short reason (e.g. 'no date on it'); else empty." },
  },
  required: ["found", "title", "date", "start_time", "end_time", "location", "details", "problem"],
  additionalProperties: false,
} as const;

async function readPictures(pictures: { data: Buffer; type: ClaudeType }[], caption: string, today: string, tz: string): Promise<Reading | null> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    // If the model declines, the request is re-run on a fallback model chosen by the API.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system:
      "You read photos of invitations, flyers and appointment cards and pull out the one event to put on someone's to-do list. " +
      `Today is ${today} (time zone ${tz}). When the year isn't shown, use the next date on or after today. ` +
      "Several pictures are the front and back of the same thing. Use only what the pictures (and the sender's note) say; leave a field empty rather than guess.",
    messages: [
      {
        role: "user",
        content: [
          ...pictures.map((p) => ({ type: "image" as const, source: { type: "base64" as const, media_type: p.type, data: p.data.toString("base64") } })),
          { type: "text" as const, text: caption ? `The sender's note: ${caption.slice(0, 500)}` : "What event is this, and when?" },
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

const REMINDERS: TodoReminder[] = [
  { when: "m:1440", push: false, text: true, email: false },
  { when: "m:180", push: false, text: true, email: false },
];

/**
 * Turns texted pictures into a to-do for this member. Returns the text to send back:
 * what was added (with a link), or what went wrong.
 */
export async function photoToTodo(memberId: number, media: { url: string; type: string }[], caption: string): Promise<string> {
  if (!photoTodoConfigured()) return "My Ward Link: reading pictures isn't set up yet (ANTHROPIC_API_KEY on the server).";
  const fetched = (await Promise.all(media.slice(0, 4).map((m) => fetchMedia(m.url)))).filter((f): f is { data: Buffer; type: string } => !!f);
  const pictures = fetched.filter((f): f is { data: Buffer; type: ClaudeType } => (CLAUDE_TYPES as readonly string[]).includes(f.type));
  if (!pictures.length) return "My Ward Link: I couldn't open that picture. Please send it as a photo (JPEG or PNG).";
  const home = homeOf(memberId);
  const tz = (home.orgId && getWard((db().prepare("SELECT ward_id FROM orgs WHERE id = ?").get(home.orgId) as { ward_id: number } | undefined)?.ward_id ?? 0)?.timezone) || "America/Boise";
  const today = DateTime.now().setZone(tz).toISODate()!;
  let reading: Reading | null = null;
  try {
    reading = await readPictures(pictures, caption, today, tz);
  } catch (err) {
    console.error("[photo-todo] reading failed", err);
  }
  if (!reading) return "My Ward Link: I couldn't read that picture just now. Please try again in a minute.";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(reading.date) ? reading.date : "";
  if (!reading.found || !date) return `My Ward Link: I couldn't find a date on that picture${reading.problem ? ` (${reading.problem})` : ""}. Add it as a to-do in the app instead.`;
  const time = /^\d{2}:\d{2}$/.test(reading.start_time) ? reading.start_time : null;
  const end = /^\d{2}:\d{2}$/.test(reading.end_time) ? reading.end_time : null;
  const hm = (t: string) => DateTime.fromFormat(t, "HH:mm").toFormat("h:mm a");
  const when = time ? `${hm(time)}${end ? ` to ${hm(end)}` : ""}` : "";
  const notes = [when && `Time: ${when}`, reading.location && `Where: ${reading.location}`, reading.details].filter(Boolean).join("\n");
  const title = (reading.title || "From a picture").slice(0, 200);
  const id = savePersonalTodo(memberId, null, { title, notes, due_date: date, due_time: time, reminders: REMINDERS });
  if (!id) return "My Ward Link: that couldn't be saved. Please try again.";
  // Keep the pictures with it (all of them, including any Claude couldn't read).
  const names: string[] = [];
  for (const f of fetched) {
    try {
      names.push(await saveUpload(new File([new Uint8Array(f.data)], "picture")));
    } catch {
      // Not a kind of picture that's kept.
    }
  }
  db().prepare("UPDATE personal_todos SET images = ? WHERE id = ?").run(JSON.stringify(names), id);
  const day = DateTime.fromISO(date).toFormat("ccc, LLL d");
  return `Posted to your to-dos: ${title}, ${day}${when ? `, ${when}` : ""}${reading.location ? `, ${reading.location}` : ""}. Text reminders 1 day and 3 hours before. ${appUrl()}/assignments/mine/${id}`;
}
