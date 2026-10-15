"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ledOrgIds, sendAnswer } from "@/lib/conversations";
import { canSendTo, getGroup, sendToAudience } from "@/lib/groups";
import { getOrg, getWard } from "@/lib/orgs";
import type { Audience } from "@/lib/notify";

const LINKS = ["/", "/lessons", "/calendar", "/plans", "/signups"];

function back(msg: string, to = ""): never {
  redirect(`/messages/new?msg=${encodeURIComponent(msg)}${to ? `&to=${encodeURIComponent(to)}` : ""}`);
}

/**
 * Messages → New message: a personal message to one person (it opens their
 * conversation), or an announcement to an organization, its presidency, upcoming
 * teachers or a message group, in any organization the leader leads.
 */
export async function composeMessage(fd: FormData) {
  const user = await requireUser();
  const to = String(fd.get("to") || "");
  const body = String(fd.get("body") || "").trim();
  const m = to.match(/^(aud|person):(\d+):(.+)$/);
  const orgId = m ? Number(m[2]) : 0;
  if (!m || !ledOrgIds(user.id).includes(orgId)) back("Choose who to send to.");
  if (!body) back("Write a message first.", to);
  const author = { id: user.id, org_id: orgId, display_name: user.display_name };

  if (m[1] === "person") {
    const memberId = Number(m[3]);
    const privately = fd.get("private") === "on";
    if (!(await sendAnswer(author, memberId, body.slice(0, 1000), privately))) back("That person isn't in this ward.", to);
    revalidatePath("/", "layout");
    // Open the conversation (in that organization), where any answer will show.
    redirect(`/admin/replies/${memberId}?org=${orgId}${privately ? "&private=1" : ""}&msg=${encodeURIComponent("Sent.")}#end`);
  }

  let audience: Audience | null = null;
  if (["everyone", "presidency", "teachers"].includes(m[3])) audience = m[3] as Audience;
  const g = m[3].match(/^group:(\d+)$/);
  const group = g ? getGroup(Number(g[1]), orgId) : undefined;
  if (group && canSendTo(group, user.id, "presidency")) audience = `group:${group.id}`;
  if (!audience) back("Choose who to send to.");
  // The subject is optional: the start of the message stands in for it.
  const title = String(fd.get("title") || "").trim().slice(0, 120) || (body.length > 60 ? `${body.slice(0, 57).trim()}…` : body);
  const link = LINKS.includes(String(fd.get("link"))) ? String(fd.get("link")) : "/";
  const tz = getWard(getOrg(orgId)?.ward_id ?? 0)?.timezone ?? user.ward.timezone;
  const { count, push, email, text, reached } = await sendToAudience({ orgId, senderId: user.id, audience, title, body: body.slice(0, 2000), link, tz });
  revalidatePath("/", "layout");
  const missed = count - reached;
  redirect(
    `/messages?tab=sent&msg=${encodeURIComponent(
      `Sent to ${count}: ${push} by notification, ${email} by email, ${text} by text${missed > 0 ? `. ${missed} couldn't be reached (notifications off and no texts or emails chosen)` : ""}.`,
    )}`,
  );
}
