"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { receiveReply, recentReplies } from "@/lib/conversations";

export async function replyToPresidency(fd: FormData) {
  const user = await requireUser();
  const body = String(fd.get("body") || "").trim();
  const messageId = Number(fd.get("message_id")) || null;
  const back = (msg: string, ok = false): never => redirect(`/messages?msg=${encodeURIComponent(msg)}${ok ? "&ok=1" : messageId ? `&re=${messageId}` : ""}#conversation`);
  if (!body) back("Write a message first.");
  if (recentReplies(user.id) >= 20) back("You've sent a lot of messages in the last hour. Please try again a little later.");
  await receiveReply(user, body, "app", messageId);
  revalidatePath("/", "layout");
  back("Sent to the presidency.", true);
}
