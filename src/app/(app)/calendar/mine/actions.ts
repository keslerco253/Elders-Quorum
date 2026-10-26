"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { remindersFromForm } from "@/lib/personal-todos";
import { deletePersonalEvent, savePersonalEvent } from "@/lib/personal-events";

const time = (v: FormDataEntryValue | null) => (/^\d{2}:\d{2}$/.test(String(v)) ? String(v) : null);

/** A member's own calendar event: new or changed. */
export async function savePersonalEventAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("item_id")) || null;
  const back = (text: string): never => redirect(`${id ? `/calendar/mine/${id}` : "/calendar/mine/new"}?msg=${encodeURIComponent(text)}`);
  const title = String(fd.get("title") || "").trim().slice(0, 200);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("date"))) ? String(fd.get("date")) : null;
  const start = time(fd.get("start_time"));
  if (!title) return back("Give your event a title.");
  if (!date || !start) return back("Choose its date and start time.");
  const saved = savePersonalEvent(user.id, id, {
    title,
    notes: String(fd.get("notes") || "").trim().slice(0, 2000),
    location: String(fd.get("location") || "").trim().slice(0, 200),
    date,
    start_time: start,
    end_time: time(fd.get("end_time")),
    timezone: user.ward.timezone,
    reminders: remindersFromForm(fd),
  });
  revalidatePath("/", "layout");
  redirect(`/calendar?${new URLSearchParams({ m: date.slice(0, 7), d: date, msg: saved ? (id ? "Event saved." : "Added to your calendar. Only you can see it.") : "That event no longer exists." })}#day`);
}

export async function deletePersonalEventAction(fd: FormData) {
  const user = await requireUser();
  deletePersonalEvent(user.id, Number(fd.get("item_id")));
  revalidatePath("/", "layout");
  redirect(`/calendar?msg=${encodeURIComponent("Event deleted.")}`);
}
