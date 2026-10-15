"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { receiveReply, recentReplies } from "@/lib/conversations";
import { canSendTo, getGroup, memberGroupSendsToday, sendToAudience } from "@/lib/groups";

export async function replyToPresidency(fd: FormData) {
  const user = await requireUser();
  const body = String(fd.get("body") || "").trim();
  const messageId = Number(fd.get("message_id")) || null;
  const back = (msg: string, ok = false): never => redirect(`/messages?tab=mine&msg=${encodeURIComponent(msg)}${ok ? "&ok=1" : messageId ? `&re=${messageId}` : ""}#conversation`);
  if (!body) back("Write a message first.");
  if (recentReplies(user.id) >= 20) back("You've sent a lot of messages in the last hour. Please try again a little later.");
  const to = Number(fd.get("to")) || 0;
  await receiveReply(user, body, "app", messageId, to ? { private: true, withId: to } : { private: false });
  revalidatePath("/", "layout");
  back(to ? "Sent privately." : "Sent to the presidency.", true);
}

/** Someone in a message group writes to it (when the group allows that). Signed with their name. */
export async function sendToGroup(fd: FormData) {
  const user = await requireUser();
  const back = (msg: string, ok = false): never => redirect(`/messages?tab=mine&gmsg=${encodeURIComponent(msg)}${ok ? "&ok=1" : ""}#group-message`);
  const g = getGroup(Number(fd.get("group_id")), user.org_id);
  const body = String(fd.get("body") || "").trim().slice(0, 1000);
  if (!g || !canSendTo(g, user.id, user.role)) return back("You can't send to that group.");
  if (!body) back("Write a message first.");
  if (memberGroupSendsToday(user.id) >= 10) back("You've sent a lot of group messages today. Please try again tomorrow.");
  const r = await sendToAudience({ orgId: user.org_id, senderId: user.id, audience: `group:${g.id}`, title: user.display_name, body, tz: user.ward.timezone, personal: { from: user.display_name } });
  revalidatePath("/", "layout");
  back(`Sent to ${r.count} in ${g.name}.`, true);
}
