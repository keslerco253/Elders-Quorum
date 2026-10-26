"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CHANNELS, KIND_LABELS, REMINDER_KINDS, saveReminderSettings, type ReminderChannel, type ReminderKind, type ReminderMode } from "@/lib/reminder-prefs";
import { memberCanText } from "./can-text";

export async function saveReminders(fd: FormData) {
  const user = await requireUser();
  const kind = String(fd.get("kind")) as ReminderKind;
  if (!REMINDER_KINDS.includes(kind)) redirect("/more/reminders");
  const mode = (["default", "custom", "off"].includes(String(fd.get("mode"))) ? String(fd.get("mode")) : "default") as ReminderMode;
  const whens = fd.getAll("when").map(String);
  // Each reminder's ways: the boxes ticked in its row (ch_<row>).
  const reminders = whens.map((when, i) => ({ when, channels: fd.getAll(`ch_${i}`).map(String).filter((c): c is ReminderChannel => CHANNELS.includes(c as ReminderChannel)) }));
  const error = saveReminderSettings(user.id, kind, mode, reminders, { text: memberCanText(user), email: !!user.email });
  redirect(`/more/reminders?${error ? "error" : "msg"}=${encodeURIComponent(error ?? `${KIND_LABELS[kind]} reminders saved.`)}#${kind}`);
}
