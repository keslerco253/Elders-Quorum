"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { saveReminderSettings, type ReminderChannel, type ReminderKind, type ReminderMode } from "@/lib/reminder-prefs";
import { memberCanText } from "./can-text";

export async function saveReminders(fd: FormData) {
  const user = await requireUser();
  const kind = String(fd.get("kind")) as ReminderKind;
  if (!["lessons", "events", "service"].includes(kind)) redirect("/more/reminders");
  const mode = (["default", "custom", "off"].includes(String(fd.get("mode"))) ? String(fd.get("mode")) : "default") as ReminderMode;
  const whens = fd.getAll("when").map(String);
  const channels = fd.getAll("channel").map(String);
  const reminders = whens.map((when, i) => ({ when, channel: (channels[i] === "text" ? "text" : "push") as ReminderChannel }));
  const error = saveReminderSettings(user.id, kind, mode, reminders, memberCanText(user));
  const label = kind === "lessons" ? "Lesson" : kind === "events" ? "Event" : "Service";
  redirect(`/more/reminders?${error ? "error" : "msg"}=${encodeURIComponent(error ?? `${label} reminders saved.`)}#${kind}`);
}
