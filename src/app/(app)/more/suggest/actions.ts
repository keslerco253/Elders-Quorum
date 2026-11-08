"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { allowHit } from "@/lib/rate-limit";
import { addSuggestion } from "@/lib/suggestions";

const back = (text: string): never => redirect(`/more/suggest?msg=${encodeURIComponent(text)}`);

/** A suggestion for the app, for the site owner's list. */
export async function suggestAction(fd: FormData) {
  const user = await requireUser();
  const body = String(fd.get("body") || "").trim();
  if (body.length < 5) back("Write your idea first.");
  if (!allowHit(`suggest:${user.id}`, 10, 24 * 60)) back("That's a lot of ideas for one day. Thank you! Please send more tomorrow.");
  await addSuggestion(user.id, user.org_id, body, user.display_name);
  revalidatePath("/more/suggest");
  back("Thank you! Your idea was sent. You'll see here (and be told) what happens with it.");
}
