"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { audienceMembers, notify } from "@/lib/notify";
import { localInputToUtc } from "@/lib/time";
import { hasFeature } from "@/lib/orgs";

export async function rsvp(fd: FormData) {
  const user = await requireUser();
  const e = getEvent(user.id, Number(fd.get("event_id")));
  if (!e || !e.rsvp_enabled) redirect("/calendar");
  const response = String(fd.get("response"));
  if (!["yes", "no", "maybe"].includes(response)) redirect(`/calendar/${e.id}`);
  db()
    .prepare("INSERT INTO event_rsvps (event_id, member_id, response) VALUES (?, ?, ?) ON CONFLICT(event_id, member_id) DO UPDATE SET response = excluded.response, updated_at = datetime('now')")
    .run(e.id, user.id, response);
  revalidatePath(`/calendar/${e.id}`);
  redirect(`/calendar/${e.id}`);
}

export async function requestEvent(fd: FormData) {
  const user = await requireUser();
  if (!hasFeature(user.org, "event_requests")) redirect(`/calendar?msg=${encodeURIComponent("Event suggestions are turned off.")}`);
  const tz = user.ward.timezone;
  const title = String(fd.get("title") || "").trim();
  const start = localInputToUtc(String(fd.get("starts_at") || ""), tz);
  const end = localInputToUtc(String(fd.get("ends_at") || ""), tz) ?? start;
  if (!title || !start || !end || end < start) redirect(`/calendar/request?msg=${encodeURIComponent("Please give a title and a valid start and end time.")}`);
  db()
    .prepare("INSERT INTO event_requests (org_id, member_id, title, description, location, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(user.org_id, user.id, title, String(fd.get("description") || "").trim(), String(fd.get("location") || "").trim(), start, end);
  await notify(audienceMembers(user.org_id, "admins").filter((m) => m.id !== user.id), {
    title: "New event request",
    body: `${user.display_name} requested "${title}".`,
    url: "/admin/event-requests",
  });
  redirect(`/calendar?msg=${encodeURIComponent("Thanks! Your request was sent. You'll be notified when it's approved or declined.")}`);
}
