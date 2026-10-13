"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { answerRequest, getRequest, validAskToken } from "@/lib/teaching-requests";

/** A member's answer to "Will you teach?" from the private link (no sign-in needed). */
export async function answerTeachingRequest(fd: FormData) {
  const id = Number(fd.get("request_id"));
  const token = String(fd.get("t") || "");
  const r = getRequest(id);
  if (!r || !validAskToken(id, r.member_id, token)) redirect(`/ask/${id}?t=${encodeURIComponent(token)}`);
  const result = await answerRequest(id, r.member_id, fd.get("answer") === "accept", String(fd.get("reason") || ""));
  revalidatePath("/", "layout");
  redirect(`/ask/${id}?t=${encodeURIComponent(token)}&done=${result}`);
}
