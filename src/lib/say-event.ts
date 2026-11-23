import Anthropic from "@anthropic-ai/sdk";
import { DateTime } from "luxon";
import { db } from "./db";
import { appUrl } from "./config";
import { allDayRange } from "./events";
import { editsEventsOf, getOrg, getWard, homeOf, orgFullName } from "./orgs";
import { savePersonalEvent, STARTING_EVENT_REMINDERS } from "./personal-events";

// "Say an event": someone says (or types, or texts) an event in their own words; Claude
// fills in its details and asks for anything missing, one question at a time, until it
// can be added: their own event (anyone), or an organization's (those who can add its
// events, as with Add event). Needs ANTHROPIC_API_KEY on the server.

export const sayEventConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** One turn: what the person said, or what the app asked. */
export interface Turn {
  who: "member" | "app";
  text: string;
}

/** The event as understood so far. */
export interface EventDraft {
  kind: "mine" | "org";
  org_id: number;
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM (24-hour), or "" (all day, or not said yet). */
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string;
  notes: string;
  leaders_only: boolean;
}

export interface Step {
  /** Everything needed is there: show it, ready to add. */
  ready: boolean;
  /** What to ask next (when not ready), or a short note. */
  question: string;
  draft: EventDraft;
}

/** The organizations whose calendar this person can add events to (as with Add event). */
export function eventOrgChoices(memberId: number, wardAdminOf: number | null = null): { id: number; label: string }[] {
  const rows = db()
    .prepare(
      `SELECT DISTINCT o.id FROM orgs o JOIN ward_members wm ON wm.ward_id = o.ward_id AND wm.member_id = ?
       WHERE o.active = 1 ORDER BY o.kind = 'ward' DESC, o.name`,
    )
    .all(memberId) as { id: number }[];
  return rows.filter((r) => editsEventsOf(memberId, r.id, wardAdminOf)).map((r) => ({ id: r.id, label: orgFullName(r.id) }));
}

const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["mine", "org"], description: "mine: on their own calendar only. org: on an organization's calendar." },
    org_id: { type: "integer", description: "For org: the id of the organization (from the list). 0 for mine or when not known yet." },
    title: { type: "string", description: "Short title, e.g. \"Wilson family move-in\". Empty if not known." },
    date: { type: "string", description: "YYYY-MM-DD, or empty if not known." },
    start_time: { type: "string", description: "24-hour HH:MM, or empty (all day, or not known)." },
    end_time: { type: "string", description: "24-hour HH:MM, or empty." },
    all_day: { type: "boolean", description: "True only if they said it's all day (or it's a whole-day thing like a deadline)." },
    location: { type: "string", description: "Where, as said, or empty." },
    notes: { type: "string", description: "Other useful details they gave, in a line or two, or empty." },
    leaders_only: { type: "boolean", description: "For org: true if it's only for the leaders (the presidency), not the members." },
    ready: { type: "boolean", description: "True when title, date, whose calendar, and a start time (or all day) are all known." },
    question: { type: "string", description: "When not ready: one short, friendly question for the most important missing thing. When ready: empty." },
  },
  required: ["kind", "org_id", "title", "date", "start_time", "end_time", "all_day", "location", "notes", "leaders_only", "ready", "question"],
  additionalProperties: false,
} as const;

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Checks Claude's reading against the rules (and what this person may do): only complete when it really is. */
export function checkDraft(raw: Partial<EventDraft> & { question?: string }, choices: { id: number }[]): Step {
  const canOrg = choices.length > 0;
  const kind = canOrg && raw.kind === "org" ? "org" : "mine";
  const orgId = kind === "org" ? (choices.find((c) => c.id === Number(raw.org_id))?.id ?? (choices.length === 1 ? choices[0].id : 0)) : 0;
  const time = (t: unknown) => (typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : "");
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) && DateTime.fromISO(raw.date).isValid ? raw.date : "";
  const start = time(raw.start_time);
  const allDay = !!raw.all_day && !start;
  const end = start ? time(raw.end_time) : "";
  const draft: EventDraft = {
    kind,
    org_id: orgId,
    title: clean(raw.title, 200),
    date,
    start_time: start,
    end_time: end && end > start ? end : "",
    all_day: allDay,
    location: clean(raw.location, 300),
    notes: clean(raw.notes, 2000),
    leaders_only: kind === "org" && !!raw.leaders_only,
  };
  const missing = !draft.title ? "What should the event be called?" : !draft.date ? "What day is it?" : !draft.start_time && !draft.all_day ? "What time does it start? (Or say \"all day\".)" : kind === "org" && !orgId ? `Which calendar is it for: ${choices.map((c) => (c as { label?: string }).label).filter(Boolean).join(", ")}?` : "";
  const ready = !missing;
  return { ready, question: ready ? "" : clean(raw.question, 300) || missing, draft };
}

/**
 * Reads the conversation so far and returns the event as understood, with the next
 * question if something is missing. Null if it can't be read just now.
 */
export async function readSpokenEvent(turns: Turn[], ctx: { memberId: number; tz: string; choices: { id: number; label: string }[]; currentOrgId?: number }): Promise<Step | null> {
  if (!sayEventConfigured()) return null;
  const today = DateTime.now().setZone(ctx.tz);
  const orgs = ctx.choices.length
    ? `They may also put it on one of these organizations' calendars (id: name): ${ctx.choices.map((c) => `${c.id}: ${c.label}`).join("; ")}.${ctx.currentOrgId && ctx.choices.some((c) => c.id === ctx.currentOrgId) ? ` They're looking at ${ctx.choices.find((c) => c.id === ctx.currentOrgId)!.label} now.` : ""} If they mention the quorum, the presidency, the ward, an activity for members, or an organization, it's an org event (leaders_only if it's only for the presidency or leaders). If it sounds personal (a dentist, a family thing), it's mine. If you can't tell, ask "Is this just for you, or for the … calendar?"`
    : "It goes on their own calendar only (kind is always mine).";
  const client = new Anthropic();
  const transcript = turns
    .slice(-12)
    .map((t) => `${t.who === "member" ? "Them" : "You asked"}: ${t.text.slice(0, 1000)}`)
    .join("\n");
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1500,
    // If the model declines, the request is re-run on a fallback model chosen by the API.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system:
      `You help a church member put an event on a calendar from what they say (often spoken, so expect dictation slips). Today is ${today.toFormat("cccc, yyyy-LL-dd")} (time zone ${ctx.tz}). ` +
      "Fill in what they said across the whole conversation; later answers win. Dates like \"Saturday\" mean the next one on or after today; \"tonight\" is today. A time with no AM/PM is the usual one (7 is 7 PM for an evening activity, 9 is 9 AM for a morning one). " +
      `${orgs} ` +
      "Needed: a title, a date, a start time (or all day), and (for org) which organization. Don't ask for anything else (place, end time and details are optional). When something needed is missing, set ready false and ask one short, friendly question for it. Never invent details.",
    messages: [{ role: "user", content: transcript }],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
  if (!text) return null;
  try {
    return checkDraft(JSON.parse(text), ctx.choices);
  } catch {
    return null;
  }
}

/** Adds a complete draft: their own event, or (if they may) an organization's. Returns its page, or null. */
export function addSpokenEvent(memberId: number, draft: EventDraft, choices: { id: number }[], tz: string): { url: string; where: string } | null {
  const step = checkDraft(draft, choices);
  if (!step.ready) return null;
  const e = step.draft;
  if (e.kind === "mine") {
    const id = savePersonalEvent(memberId, null, {
      title: e.title,
      notes: e.notes,
      location: e.location,
      date: e.date,
      start_time: e.start_time || "00:00",
      end_time: e.end_time || null,
      all_day: e.all_day,
      timezone: tz,
      reminders: STARTING_EVENT_REMINDERS,
    });
    return id ? { url: `/calendar/mine/${id}`, where: "your calendar" } : null;
  }
  const orgTz = getWard(getOrg(e.org_id)?.ward_id ?? 0)?.timezone ?? tz;
  let starts: string;
  let ends: string;
  if (e.all_day) ({ start: starts, end: ends } = allDayRange(e.date, null, orgTz));
  else {
    const s = DateTime.fromISO(`${e.date}T${e.start_time}`, { zone: orgTz });
    const f = e.end_time ? DateTime.fromISO(`${e.date}T${e.end_time}`, { zone: orgTz }) : s.plus({ hours: 1 });
    starts = s.toUTC().toISO({ suppressMilliseconds: true })!;
    ends = f.toUTC().toISO({ suppressMilliseconds: true })!;
  }
  const id = Number(
    db()
      .prepare("INSERT INTO events (org_id, title, description, location, starts_at, ends_at, all_day, presidency_only, reminder_minutes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1440, ?)")
      .run(e.org_id, e.title, e.notes, e.location, starts, ends, e.all_day ? 1 : 0, e.leaders_only ? 1 : 0, memberId).lastInsertRowid,
  );
  return { url: `/calendar/${id}?org=${e.org_id}`, where: `the ${orgFullName(e.org_id)} calendar${e.leaders_only ? " (leaders only)" : ""}` };
}

/** "Sat, Nov 28, 9:00 AM to 12:00 PM at 123 Main" for a draft. */
export function draftWhen(e: EventDraft): string {
  const day = e.date ? DateTime.fromISO(e.date).toFormat("ccc, LLL d") : "";
  const t = (s: string) => DateTime.fromFormat(s, "HH:mm").toFormat("h:mm a");
  const time = e.all_day ? "all day" : e.start_time ? `${t(e.start_time)}${e.end_time ? ` to ${t(e.end_time)}` : ""}` : "";
  return [day, time].filter(Boolean).join(", ") + (e.location ? ` at ${e.location}` : "");
}

// ---- By text: a leader texts EVENT and what it is; the app asks what's missing. ----

const TEXT_WINDOW_MIN = 30;

/** A conversation by text still going (texted in the last half hour). */
export function textEventDraft(memberId: number): Turn[] | null {
  const row = db().prepare(`SELECT turns FROM text_event_drafts WHERE member_id = ? AND updated_at > datetime('now', '-${TEXT_WINDOW_MIN} minutes')`).get(memberId) as { turns: string } | undefined;
  try {
    return row ? (JSON.parse(row.turns) as Turn[]) : null;
  } catch {
    return null;
  }
}

function saveTextTurns(memberId: number, turns: Turn[] | null) {
  if (!turns) db().prepare("DELETE FROM text_event_drafts WHERE member_id = ?").run(memberId);
  else
    db()
      .prepare("INSERT INTO text_event_drafts (member_id, turns) VALUES (?, ?) ON CONFLICT(member_id) DO UPDATE SET turns = excluded.turns, updated_at = datetime('now')")
      .run(memberId, JSON.stringify(turns.slice(-12)));
}

/**
 * A text from a leader: "EVENT …" starts one; while one is going, their texts answer its
 * questions (SKIP ends it). Returns the reply to text back, or null when it isn't about
 * an event (their text is handled as usual).
 */
export async function textEvent(memberId: number, body: string): Promise<string | null> {
  const start = body.match(/^\s*event\b[\s:,.-]*(.*)$/is);
  const going = textEventDraft(memberId);
  if (!start && !going) return null;
  if (!start && /^\s*skip\s*$/i.test(body)) {
    saveTextTurns(memberId, null);
    return "My Ward Link: OK, that event wasn't added.";
  }
  const turns: Turn[] = start ? [] : [...going!];
  const said = start ? start[1].trim() : body.trim();
  if (!said) {
    saveTextTurns(memberId, [{ who: "app", text: "What's the event? Say what, when and where." }]);
    return "My Ward Link: What's the event? Text what, when and where (like \"Wilson move-in Sat 9am at 123 Main\").";
  }
  turns.push({ who: "member", text: said });
  const home = homeOf(memberId).orgId;
  const tz = getWard(getOrg(home ?? 0)?.ward_id ?? 0)?.timezone ?? "America/Boise";
  const choices = eventOrgChoices(memberId);
  let step: Step | null = null;
  try {
    step = await readSpokenEvent(turns, { memberId, tz, choices, currentOrgId: home ?? undefined });
  } catch (err) {
    console.error("[say-event] text reading failed", err);
  }
  if (!step) {
    saveTextTurns(memberId, turns);
    return sayEventConfigured() ? "My Ward Link: I couldn't read that just now. Please text it again in a minute." : "My Ward Link: adding events by text isn't set up yet.";
  }
  if (!step.ready) {
    saveTextTurns(memberId, [...turns, { who: "app", text: step.question }]);
    return `My Ward Link: ${step.question} (Reply SKIP to cancel.)`;
  }
  saveTextTurns(memberId, null);
  const added = addSpokenEvent(memberId, step.draft, choices, tz);
  if (!added) return "My Ward Link: that event couldn't be added. Please try again, or use the app.";
  return `My Ward Link: Added to ${added.where}: ${step.draft.title}, ${draftWhen(step.draft)}. Change it here: ${appUrl()}${added.url}`;
}
