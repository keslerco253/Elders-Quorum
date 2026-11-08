"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { setSuggestionStatus, SUGGESTION_STATUSES, type SuggestionStatus } from "@/lib/suggestions";

/** The site owner moves a suggestion to working on it, done or declined (with a note back). */
export async function setSuggestionAction(fd: FormData) {
  const user = await requireUser();
  if (!user.is_site_owner) redirect("/");
  const status = String(fd.get("status")) as SuggestionStatus;
  if (!SUGGESTION_STATUSES.some(([k]) => k === status)) redirect("/site/suggestions");
  const view = String(fd.get("view") || "new");
  await setSuggestionStatus(Number(fd.get("id")), status, String(fd.get("note") || ""), fd.get("tell") === "on");
  revalidatePath("/", "layout");
  redirect(`/site/suggestions?view=${encodeURIComponent(view)}&msg=${encodeURIComponent("Saved.")}`);
}
