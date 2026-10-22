"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ledOrgIds, receiveReply, recentReplies } from "@/lib/conversations";
import { canSendTo, getGroup, memberGroupSendsToday, sendToAudience } from "@/lib/groups";
import { getOrg, getWard, myOrgs } from "@/lib/orgs";
import { canWritePrivately, closedText, orgTakesMessages, wardTakesMessages } from "@/lib/message-routing";
import type { CurrentUser } from "@/lib/types";

const threadUrl = (orgId: number, withId: number, msg?: string) => `/messages/thread/${withId || "all"}?org=${orgId}${msg ? `&msg=${encodeURIComponent(msg)}` : ""}#end`;

/** A member writes to an organization's leaders: all of them, or one privately. */
async function writeToLeaders(user: CurrentUser, orgId: number, withId: number, body: string, messageId: number | null, back: (msg: string) => never) {
  if (!myOrgs(user.id).some((o) => o.id === orgId)) back("You can't write to that organization.");
  if (!orgTakesMessages(orgId, user.id)) back(closedText(getOrg(orgId)!));
  if (withId && !canWritePrivately(orgId, user.id, withId)) back("They don't take messages through the app. You can write to the whole presidency instead.");
  if (!body) back("Write a message first.");
  if (recentReplies(user.id) >= 20) back("You've sent a lot of messages in the last hour. Please try again a little later.");
  await receiveReply({ id: user.id, org_id: orgId, display_name: user.display_name }, body, "app", messageId, withId ? { private: true, withId } : { private: false });
  revalidatePath("/", "layout");
  redirect(threadUrl(orgId, withId));
}

/** The reply box at the bottom of a conversation (or under an announcement). */
export async function sendInThread(fd: FormData) {
  const user = await requireUser();
  const orgId = Number(fd.get("org_id"));
  const withId = Number(fd.get("with")) || 0;
  const messageId = Number(fd.get("message_id")) || null;
  const body = String(fd.get("body") || "").trim();
  const back = (msg: string): never => redirect(messageId ? `/messages/a/${messageId}?msg=${encodeURIComponent(msg)}` : threadUrl(orgId, withId, msg));
  await writeToLeaders(user, orgId, withId, body, messageId, back);
}

/** New message, for members: to their leaders (all or one privately), or to a message group that lets members send. */
export async function memberCompose(fd: FormData) {
  const user = await requireUser();
  const to = String(fd.get("to") || "");
  const body = String(fd.get("body") || "").trim();
  const back = (msg: string): never => redirect(`/messages/new?as=member&to=${encodeURIComponent(to)}&msg=${encodeURIComponent(msg)}`);
  const m = to.match(/^([pg]):(\d+):(\d+)$/);
  if (!m) back("Choose who to send to.");
  const [, kind, org, id] = m!;
  const orgId = Number(org);
  if (kind === "p") await writeToLeaders(user, orgId, Number(id), body, null, back);
  const membership = myOrgs(user.id).find((o) => o.id === orgId);
  const g = membership ? getGroup(Number(id), orgId) : undefined;
  if (!g || !canSendTo(g, user.id, membership!.role)) back("You can't send to that group.");
  if (membership!.role === "member" && !wardTakesMessages(membership!.ward_id)) back("Your ward doesn't take messages from members through the app.");
  if (!body) back("Write a message first.");
  if (memberGroupSendsToday(user.id) >= 10) back("You've sent a lot of group messages today. Please try again tomorrow.");
  const tz = getWard(membership!.ward_id)?.timezone ?? user.ward.timezone;
  const r = await sendToAudience({ orgId, senderId: user.id, audience: `group:${g!.id}`, title: user.display_name, body: body.slice(0, 1000), tz, personal: { from: user.display_name } });
  revalidatePath("/", "layout");
  const sent = ledOrgIds(user.id).length ? "/messages?tab=mine&view=sent" : "/messages?view=sent";
  redirect(`${sent}&msg=${encodeURIComponent(`Sent to ${r.count} in ${g!.name}.`)}`);
}
