"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseAlerts } from "@/lib/events";
import { FEED_CONTENTS } from "@/lib/types";

/** Makes a new subscription link; the old one stops working. */
export async function resetFeedLink() {
  const user = await requireUser();
  db().prepare("UPDATE members SET feed_version = feed_version + 1 WHERE id = ?").run(user.id);
  redirect(`/calendar/subscribe?msg=${encodeURIComponent("Your link was reset. Calendars using the old link will stop updating; subscribe again with the new one.")}`);
}

/** Saves the reminders to put on events in the member's calendar. */
export async function saveCalendarAlerts(fd: FormData) {
  const user = await requireUser();
  const alerts = parseAlerts([fd.get("alert1"), fd.get("alert2")].filter(Boolean).join(","));
  db().prepare("UPDATE members SET calendar_alerts = ? WHERE id = ?").run(alerts.join(","), user.id);
  redirect(`/calendar/subscribe?ok=1&msg=${encodeURIComponent(alerts.length ? "Reminders saved. Your calendar picks them up the next time it checks for changes." : "Reminders turned off.")}#reminders`);
}

/** Chooses what the member's subscribed calendar holds: ward events, their own, or both. */
export async function saveFeedContents(fd: FormData) {
  const user = await requireUser();
  const value = FEED_CONTENTS.find(([v]) => v === fd.get("contents"))?.[0] ?? "both";
  db().prepare("UPDATE members SET feed_contents = ? WHERE id = ?").run(value, user.id);
  redirect(`/calendar/subscribe?ok=1&msg=${encodeURIComponent("Saved. Your calendar picks it up the next time it checks for changes.")}#contents`);
}
