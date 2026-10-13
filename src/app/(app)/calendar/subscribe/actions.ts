"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Makes a new subscription link; the old one stops working. */
export async function resetFeedLink() {
  const user = await requireUser();
  db().prepare("UPDATE members SET feed_version = feed_version + 1 WHERE id = ?").run(user.id);
  redirect(`/calendar/subscribe?msg=${encodeURIComponent("Your link was reset. Calendars using the old link will stop updating; subscribe again with the new one.")}`);
}
