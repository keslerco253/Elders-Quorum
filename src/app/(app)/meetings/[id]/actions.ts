"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { respondToMeeting } from "@/lib/meetings";

/** Someone invited says whether they'll come (saved in place). */
export async function respondMeeting(fd: FormData) {
  const user = await requireUser();
  const response = fd.get("response") === "no" ? "no" : "yes";
  respondToMeeting(Number(fd.get("meeting_id")), user.id, response);
  revalidatePath("/", "layout");
}
