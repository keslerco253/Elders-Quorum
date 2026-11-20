"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { cancelScheduled, editableScheduled, updateScheduled } from "@/lib/scheduled-messages";
import { getOrg, getWard } from "@/lib/orgs";
import { localInputToUtc } from "@/lib/time";

function back(msg: string, err = false): never {
  revalidatePath("/messages", "layout");
  redirect(`/messages/scheduled?msg=${encodeURIComponent(msg)}${err ? "&err=1" : ""}`);
}

/** New wording or times for a scheduled message (or its reminder). */
export async function saveScheduled(fd: FormData) {
  const user = await requireUser();
  const s = editableScheduled(Number(fd.get("id")), user.id);
  if (!s) back("That message has already gone out, or isn't yours to change.", true);
  const tz = getWard(getOrg(s.org_id)?.ward_id ?? 0)?.timezone ?? user.ward.timezone;
  const at = (name: string) => {
    const v = String(fd.get(name) || "");
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? localInputToUtc(v, tz) : null;
  };
  const body = String(fd.get("body") || "").trim().slice(0, 2000);
  if (!body) back("The message can't be empty.", true);
  const title = String(fd.get("title") || "").trim().slice(0, 120) || (body.length > 60 ? `${body.slice(0, 57).trim()}…` : body);
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const sendAt = s.sent_at ? s.send_at : at("send_at");
  if (!sendAt || (!s.sent_at && sendAt <= now)) back("Choose a time in the future to send it.", true);
  const reminderAt = fd.get("remind") === "on" ? at("reminder_at") : null;
  if (fd.get("remind") === "on" && (!reminderAt || reminderAt <= sendAt || reminderAt <= now)) back("Choose a reminder time in the future, after the message goes out.", true);
  updateScheduled(s.id, user.id, { title, body, send_at: sendAt, reminder_at: reminderAt });
  back("Saved.");
}

export async function cancelScheduledAction(fd: FormData) {
  const user = await requireUser();
  const s = editableScheduled(Number(fd.get("id")), user.id);
  if (!s || !cancelScheduled(s.id, user.id)) back("That message has already gone out.", true);
  back(s.sent_at ? "Reminder canceled." : "Canceled: it won't be sent.");
}
