"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { localInputToUtc, formatDateTime } from "@/lib/time";
import { notify, recipientById } from "@/lib/notify";
import { announceRecipients, notifiedNote, readTargets } from "@/lib/announce";
import { renderTemplate } from "@/lib/templates";
import { DateTime } from "luxon";
import { orgsInWard } from "@/lib/orgs";
import { createSeries, endSeriesBefore, getSeries, type SeriesInput } from "@/lib/event-series";
import { saveUpload } from "@/lib/uploads";
import { describeRecurrence, patternOptions, type Pattern } from "@/lib/recurrence";
import type { EventRow } from "@/lib/types";

function go(path: string, text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`);
}

/** Other organizations invited: "ward", or ids of this ward's other organizations ("5,7"). */
function readInvited(fd: FormData, user: { org_id: number; ward_id: number; org: { kind: string } }) {
  if (user.org.kind === "ward") return "";
  const wanted = fd.getAll("invite").map(String);
  if (wanted.includes("ward")) return "ward";
  const ok = new Set(orgsInWard(user.ward_id).filter((o) => o.kind === "group" && o.id !== user.org_id).map((o) => o.id));
  return [...new Set(wanted.map(Number))].filter((id) => ok.has(id)).sort((a, b) => a - b).join(",");
}

function readEvent(fd: FormData, tz: string) {
  const start = localInputToUtc(String(fd.get("starts_at") || ""), tz);
  const end = localInputToUtc(String(fd.get("ends_at") || ""), tz);
  const reminder = String(fd.get("reminder_minutes") || "");
  const reminder2 = String(fd.get("reminder2_minutes") || "");
  return {
    title: String(fd.get("title") || "").trim(),
    description: String(fd.get("description") || "").trim(),
    location: String(fd.get("location") || "").trim(),
    start,
    end,
    presidencyOnly: fd.get("presidency_only") === "on" ? 1 : 0,
    rsvp: fd.get("rsvp_enabled") === "on" ? 1 : 0,
    reminder: reminder ? Number(reminder) : null,
    reminder2: reminder2 ? Number(reminder2) : null,
    // Set by saveEvent: the organizations invited, and any new flyer.
    invited: "",
    flyerFile: null as string | null,
    flyerName: null as string | null,
  };
}

/** Reads the Repeats fields. Returns null for "Does not repeat" (or an invalid choice). */
function readRepeat(fd: FormData, startLocal: DateTime) {
  const pattern = String(fd.get("repeat") || "") as Pattern;
  if (!patternOptions(startLocal.toISODate()!).some((o) => o.value === pattern)) return null;
  const endKind = String(fd.get("repeat_end") || "never");
  const until = String(fd.get("repeat_until") || "");
  const count = Math.round(Number(fd.get("repeat_count")));
  return {
    pattern,
    until: endKind === "until" && /^\d{4}-\d{2}-\d{2}$/.test(until) && until >= startLocal.toISODate()! ? until : null,
    count: endKind === "count" && count >= 2 && count <= 200 ? count : null,
  };
}

function seriesInput(user: { id: number; org_id: number }, e: ReturnType<typeof readEvent>, startLocal: DateTime, endLocal: DateTime, r: NonNullable<ReturnType<typeof readRepeat>>): SeriesInput {
  return {
    org_id: user.org_id,
    pattern: r.pattern,
    start_date: startLocal.toISODate()!,
    start_time: startLocal.toFormat("HH:mm"),
    duration_minutes: Math.round(endLocal.diff(startLocal, "minutes").minutes),
    until_date: r.until,
    max_count: r.count,
    title: e.title,
    description: e.description,
    location: e.location,
    presidency_only: e.presidencyOnly,
    rsvp_enabled: e.rsvp,
    reminder_minutes: e.reminder,
    reminder2_minutes: e.reminder2,
    flyer_file: e.flyerFile,
    flyer_name: e.flyerName,
    created_by: user.id,
    invited: e.invited,
  };
}

const firstEventOf = (seriesId: number) => (db().prepare("SELECT id FROM events WHERE series_id = ? ORDER BY starts_at LIMIT 1").get(seriesId) as { id: number } | undefined)?.id;

export async function saveEvent(fd: FormData) {
  const user = await requireAdmin();
  const tz = user.ward.timezone;
  const id = Number(fd.get("item_id")) || null;
  const e = readEvent(fd, tz);
  e.invited = readInvited(fd, user);
  const back = id ? `/admin/events/${id}` : "/admin/events/new";
  if (!e.title || !e.start || !e.end) go(back, "Please give a title, start and end.");
  if (e.end! < e.start!) go(back, "The end must be after the start.");
  const startLocal = DateTime.fromISO(e.start!, { zone: "utc" }).setZone(tz);
  const endLocal = DateTime.fromISO(e.end!, { zone: "utc" }).setZone(tz);
  const repeat = readRepeat(fd, startLocal);
  const d = db();
  // The flyer: a new upload, the one it had, or none.
  const prev = id ? (d.prepare("SELECT flyer_file, flyer_name FROM events WHERE id = ? AND org_id = ?").get(id, user.org_id) as { flyer_file: string | null; flyer_name: string | null } | undefined) : undefined;
  e.flyerFile = fd.get("remove_flyer") === "on" ? null : (prev?.flyer_file ?? null);
  e.flyerName = e.flyerFile ? (prev?.flyer_name ?? null) : null;
  const file = fd.get("flyer");
  if (file instanceof File && file.size > 0) {
    if (file.size > 15_000_000) go(back, "The flyer must be under 15 MB.");
    try {
      e.flyerFile = await saveUpload(file);
      e.flyerName = file.name.slice(0, 200) || "Flyer";
      // Recorded with the ward, so only its members can open it.
      d.prepare("INSERT INTO plan_files (name, ward_id, original_name, uploaded_by) VALUES (?, ?, ?, ?)").run(e.flyerFile, user.ward_id, e.flyerName, user.id);
    } catch {
      go(back, "That kind of file can't be attached. Use a PDF or a picture (PNG, JPEG, GIF, WebP or an iPhone photo).");
    }
  }
  const update = (eventId: number) =>
    d
      .prepare(
        "UPDATE events SET title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?, presidency_only = ?, rsvp_enabled = ?, reminder_minutes = ?, reminder2_minutes = ?, flyer_file = ?, flyer_name = ?, invited = ? WHERE id = ? AND org_id = ?",
      )
      .run(e.title, e.description, e.location, e.start, e.end, e.presidencyOnly, e.rsvp, e.reminder, e.reminder2, e.flyerFile, e.flyerName, e.invited, eventId, user.org_id);
  let eventId = id;
  let note = "Event saved.";

  if (!id) {
    if (repeat) {
      const seriesId = createSeries(seriesInput(user, e, startLocal, endLocal, repeat));
      eventId = firstEventOf(seriesId) ?? null;
      const n = (d.prepare("SELECT COUNT(*) AS n FROM events WHERE series_id = ?").get(seriesId) as { n: number }).n;
      note = `Repeating event saved: ${describeRecurrence({ pattern: repeat.pattern, start: startLocal.toISODate()!, until: repeat.until, count: repeat.count })}. ${n} dates added to the calendar.`;
      if (!eventId) go("/calendar", "No dates matched that pattern.");
    } else {
      eventId = Number(
        d
          .prepare(
            "INSERT INTO events (org_id, title, description, location, starts_at, ends_at, presidency_only, rsvp_enabled, reminder_minutes, reminder2_minutes, flyer_file, flyer_name, created_by, invited) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(user.org_id, e.title, e.description, e.location, e.start, e.end, e.presidencyOnly, e.rsvp, e.reminder, e.reminder2, e.flyerFile, e.flyerName, user.id, e.invited).lastInsertRowid,
      );
    }
  } else {
    const existing = d.prepare("SELECT * FROM events WHERE id = ? AND org_id = ?").get(id, user.org_id) as EventRow | undefined;
    if (!existing) redirect("/calendar");
    const series = getSeries(user.org_id, existing.series_id);
    const exLocal = DateTime.fromISO(existing.starts_at, { zone: "utc" }).setZone(tz);
    if (series && fd.get("scope") === "future") {
      const sameShape =
        !!repeat &&
        repeat.pattern === series.pattern &&
        repeat.until === series.until_date &&
        repeat.count === series.max_count &&
        startLocal.toISODate() === exLocal.toISODate() &&
        startLocal.toFormat("HH:mm") === series.start_time &&
        Math.round(endLocal.diff(startLocal, "minutes").minutes) === series.duration_minutes;
      if (sameShape) {
        // Same dates and times: update the details on this and later dates, keeping RSVPs.
        d.transaction(() => {
          const details = [e.title, e.description, e.location, e.presidencyOnly, e.rsvp, e.reminder, e.reminder2, e.flyerFile, e.flyerName, e.invited];
          const SET = "title = ?, description = ?, location = ?, presidency_only = ?, rsvp_enabled = ?, reminder_minutes = ?, reminder2_minutes = ?, flyer_file = ?, flyer_name = ?, invited = ?";
          d.prepare(`UPDATE events SET ${SET} WHERE series_id = ? AND starts_at >= ?`).run(...details, series.id, existing.starts_at);
          d.prepare(`UPDATE event_series SET ${SET} WHERE id = ?`).run(...details, series.id);
        })();
        note = "Saved for this and all future dates.";
      } else if (repeat) {
        // New time or pattern: end the old series here (or at the new first date, if
        // that's earlier) and start a new one from this date. "10 times" still means 10
        // in all: the dates already held count toward it.
        const startUtc = startLocal.toUTC().toISO({ suppressMilliseconds: true })!;
        const endFrom = startUtc < existing.starts_at ? startUtc : existing.starts_at;
        const held = (d.prepare("SELECT COUNT(*) AS n FROM events WHERE series_id = ? AND starts_at < ?").get(series.id, endFrom) as { n: number }).n;
        const count = repeat.count && repeat.count === series.max_count ? Math.max(1, repeat.count - held) : repeat.count;
        const lastDate = (startLocal < exLocal ? startLocal : exLocal).minus({ days: 1 }).toISODate()!;
        endSeriesBefore(series, endFrom, lastDate);
        const seriesId = createSeries(seriesInput(user, e, startLocal, endLocal, { ...repeat, count }));
        eventId = firstEventOf(seriesId) ?? null;
        note = "Saved for this and all future dates.";
        if (!eventId) go("/calendar", "No dates matched that pattern.");
      } else {
        // "Does not repeat" from here: keep this date as a one-time event, drop later ones.
        endSeriesBefore(series, DateTime.fromISO(existing.starts_at).plus({ seconds: 1 }).toUTC().toISO()!, exLocal.toISODate()!);
        update(id);
        d.prepare("UPDATE events SET series_id = NULL WHERE id = ?").run(id);
        note = "Saved. Later dates were removed; this event no longer repeats.";
      }
    } else if (!series && repeat) {
      // A one-time event that should now repeat: it becomes the first date.
      update(id);
      createSeries(seriesInput(user, e, startLocal, endLocal, repeat), id);
      note = `Saved. It now repeats: ${describeRecurrence({ pattern: repeat.pattern, start: startLocal.toISODate()!, until: repeat.until, count: repeat.count })}.`;
    } else {
      update(id);
    }
  }
  // "Send a notification" (new) or "Send an update" (changed): tell the chosen people.
  if (eventId && fd.get("announce") === "on") {
    const before = id ? (db().prepare("SELECT announced_to FROM events WHERE id = ?").get(id) as { announced_to: string | null } | undefined)?.announced_to : null;
    const targets = readTargets(fd, before);
    const people = announceRecipients(user, targets, {
      leadersOnly: !!e.presidencyOnly,
      eventId,
      event: { org_id: user.org_id, invited: e.invited, presidency_only: e.presidencyOnly },
    });
    await notify(people, {
      ...renderTemplate(user.org_id, id ? "event_updated" : "event_new", { event: e.title, date_time: formatDateTime(e.start!, tz), location: e.location }),
      url: `/calendar/${eventId}`,
    });
    if (targets.length) db().prepare("UPDATE events SET announced_to = ? WHERE id = ?").run(targets.join(","), eventId);
    note += notifiedNote(people.length);
  }
  revalidatePath("/calendar", "layout");
  go(`/calendar/${eventId}`, note);
}

export async function deleteEvent(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("item_id"));
  const existing = db().prepare("SELECT * FROM events WHERE id = ? AND org_id = ?").get(id, user.org_id) as EventRow | undefined;
  if (!existing) redirect("/calendar");
  const series = getSeries(user.org_id, existing.series_id);
  if (series && fd.get("scope") === "future") {
    const day = DateTime.fromISO(existing.starts_at, { zone: "utc" }).setZone(user.ward.timezone);
    endSeriesBefore(series, existing.starts_at, day.minus({ days: 1 }).toISODate()!);
    revalidatePath("/calendar", "layout");
    go("/calendar", "This and all future dates were deleted.");
  }
  db().prepare("DELETE FROM events WHERE id = ? AND org_id = ?").run(id, user.org_id);
  revalidatePath("/calendar", "layout");
  go("/calendar", "Event deleted.");
}

interface RequestRow {
  id: number;
  member_id: number;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  email: string | null;
  display_name: string;
}

export async function decideEventRequest(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("item_id"));
  const approve = fd.get("decision") === "approve";
  const note = String(fd.get("note") || "").trim();
  const r = db()
    .prepare("SELECT er.*, m.email, m.display_name FROM event_requests er JOIN members m ON m.id = er.member_id WHERE er.id = ? AND er.org_id = ? AND er.status = 'pending'")
    .get(id, user.org_id) as RequestRow | undefined;
  if (!r) redirect("/admin/event-requests");
  let eventId: number | null = null;
  if (approve) {
    const ins = db()
      .prepare("INSERT INTO events (org_id, title, description, location, starts_at, ends_at, reminder_minutes, created_by) VALUES (?, ?, ?, ?, ?, ?, 1440, ?)")
      .run(user.org_id, r.title, r.description, r.location, r.starts_at, r.ends_at, user.id);
    eventId = Number(ins.lastInsertRowid);
  }
  db().prepare("UPDATE event_requests SET status = ?, decision_note = ?, decided_by = ?, event_id = ? WHERE id = ?").run(approve ? "approved" : "declined", note || null, user.id, eventId, id);
  const when = formatDateTime(r.starts_at, user.ward.timezone);
  const recipient = recipientById(r.member_id, user.org_id);
  if (recipient) await notify([recipient], {
    title: approve ? "Your event was approved" : "About your event request",
    body: approve ? `"${r.title}" (${when}) is on the ward calendar.${note ? `\n\n${note}` : ""}` : `"${r.title}" (${when}) wasn't added to the calendar.${note ? `\n\n${note}` : ""}`,
    url: eventId ? `/calendar/${eventId}` : "/calendar",
  }, { followUp: { what: `Their event request was ${approve ? "approved" : "declined"}: ${r.title}` } });
  revalidatePath("/admin/event-requests");
  revalidatePath("/calendar", "layout");
  go(approve ? `/admin/events/${eventId}` : "/admin/event-requests", approve ? "Approved and added to the calendar. Adjust anything below if needed." : "Request declined.");
}
