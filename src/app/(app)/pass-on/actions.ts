"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { forwardMessage, handlesBackup } from "@/lib/message-routing";

/** Forwards a member's message (from Pass it on, or a conversation) to another organization or leader. */
export async function forwardMemberMessage(fd: FormData) {
  const user = await requireUser();
  const back = String(fd.get("back") || "/pass-on");
  // A page on this site only (not "//other" or "/\\other", which browsers treat as another site).
  const safeBack = /^\/(?!\/)[^\s\\]*$/.test(back) ? back : "/pass-on";
  const where = await forwardMessage(user, Number(fd.get("message_id")), String(fd.get("target") || ""));
  revalidatePath("/", "layout");
  redirect(`${safeBack}${safeBack.includes("?") ? "&" : "?"}msg=${encodeURIComponent(where ? `Forwarded to ${where}. They've been notified, and the member's next texted reply goes to them.` : "That couldn't be forwarded.")}`);
}

/** Taken care of some other way (e.g. a phone call): off the Pass it on list. */
export async function markHandled(fd: FormData) {
  const user = await requireUser();
  if (!handlesBackup(user)) redirect("/");
  db()
    .prepare("UPDATE member_messages SET needs_home = 0, note = ? WHERE id = ? AND org_id IN (SELECT id FROM orgs WHERE ward_id = ?)")
    .run(`Marked as taken care of by ${user.display_name}`, Number(fd.get("message_id")), user.ward_id);
  revalidatePath("/pass-on");
  redirect("/pass-on?msg=Taken+care+of.");
}
