"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { localInputToUtc, formatDateTime } from "@/lib/time";
import { notify, type Recipient } from "@/lib/notify";

const go = (path: string, text: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`);

function readEvent(fd: FormData, tz: string) {
  const start = localInputToUtc(String(fd.get("starts_at") || ""), tz);
  const end = localInputToUtc(String(fd.get("ends_at") || ""), tz);
  const reminder = String(fd.get("reminder_minutes") || "");
  return {
    title: String(fd.get("title") || "").trim(),
    description: String(fd.get("description") || "").trim(),
    location: String(fd.get("location") || "").trim(),
    start,
    end,
    presidencyOnly: fd.get("presidency_only") === "on" ? 1 : 0,
    rsvp: fd.get("rsvp_enabled") === "on" ? 1 : 0,
    reminder: reminder ? Number(reminder) : null,
  };
}

export async function saveEvent(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("id")) || null;
  const e = readEvent(fd, user.ward.timezone);
  const back = id ? `/admin/events/${id}` : "/admin/events/new";
  if (!e.title || !e.start || !e.end) go(back, "Please give a title, start and end.");
  if (e.end! < e.start!) go(back, "The end must be after the start.");
  let eventId = id;
  if (id) {
    const r = db()
      .prepare("UPDATE events SET title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?, presidency_only = ?, rsvp_enabled = ?, reminder_minutes = ? WHERE id = ? AND ward_id = ?")
      .run(e.title, e.description, e.location, e.start, e.end, e.presidencyOnly, e.rsvp, e.reminder, id, user.ward_id);
    if (!r.changes) redirect("/calendar");
  } else {
    const r = db()
      .prepare("INSERT INTO events (ward_id, title, description, location, starts_at, ends_at, presidency_only, rsvp_enabled, reminder_minutes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(user.ward_id, e.title, e.description, e.location, e.start, e.end, e.presidencyOnly, e.rsvp, e.reminder, user.id);
    eventId = Number(r.lastInsertRowid);
  }
  revalidatePath("/calendar", "layout");
  go(`/calendar/${eventId}`, "Event saved.");
}

export async function deleteEvent(fd: FormData) {
  const user = await requireAdmin();
  db().prepare("DELETE FROM events WHERE id = ? AND ward_id = ?").run(Number(fd.get("id")), user.ward_id);
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
  const id = Number(fd.get("id"));
  const approve = fd.get("decision") === "approve";
  const note = String(fd.get("note") || "").trim();
  const r = db()
    .prepare("SELECT er.*, m.email, m.display_name FROM event_requests er JOIN members m ON m.id = er.member_id WHERE er.id = ? AND er.ward_id = ? AND er.status = 'pending'")
    .get(id, user.ward_id) as RequestRow | undefined;
  if (!r) redirect("/admin/event-requests");
  let eventId: number | null = null;
  if (approve) {
    const ins = db()
      .prepare("INSERT INTO events (ward_id, title, description, location, starts_at, ends_at, reminder_minutes, created_by) VALUES (?, ?, ?, ?, ?, ?, 1440, ?)")
      .run(user.ward_id, r.title, r.description, r.location, r.starts_at, r.ends_at, user.id);
    eventId = Number(ins.lastInsertRowid);
  }
  db().prepare("UPDATE event_requests SET status = ?, decision_note = ?, decided_by = ?, event_id = ? WHERE id = ?").run(approve ? "approved" : "declined", note || null, user.id, eventId, id);
  const when = formatDateTime(r.starts_at, user.ward.timezone);
  const recipient: Recipient = { id: r.member_id, email: r.email, display_name: r.display_name };
  await notify([recipient], {
    title: approve ? "Your event was approved" : "About your event request",
    body: approve ? `"${r.title}" (${when}) is on the quorum calendar.${note ? `\n\n${note}` : ""}` : `"${r.title}" (${when}) wasn't added to the calendar.${note ? `\n\n${note}` : ""}`,
    url: eventId ? `/calendar/${eventId}` : "/calendar",
  });
  revalidatePath("/admin/event-requests");
  revalidatePath("/calendar", "layout");
  go(approve ? `/admin/events/${eventId}` : "/admin/event-requests", approve ? "Approved and added to the calendar. Adjust anything below if needed." : "Request declined.");
}
