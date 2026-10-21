"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ledOrgIds, sendAnswer } from "@/lib/conversations";
import { canSendTo, getGroup, sendToAudience } from "@/lib/groups";
import { getOrg, getWard } from "@/lib/orgs";
import type { Audience } from "@/lib/notify";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
import { addAgendaItem } from "@/lib/meetings";
import { hasFeature } from "@/lib/orgs";
import { audienceLabel } from "@/lib/notify";

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
  let body = String(fd.get("body") || "").trim();
  const file = fd.get("flyer");
  const hasFlyer = file instanceof File && file.size > 0 && !String(to).startsWith("person:");
  const m = to.match(/^(aud|person):(\d+):(.+)$/);
  const orgId = m ? Number(m[2]) : 0;
  if (!m || !ledOrgIds(user.id).includes(orgId)) back("Choose who to send to.");
  if (!body && hasFlyer) body = "Please see the attached flyer.";
  if (!body) back("Write a message first.", to);
  const author = { id: user.id, org_id: orgId, display_name: user.display_name };
  // "Add to the next presidency meeting's agenda" (presidency members, where meetings are on).
  const org = getOrg(orgId);
  const agenda = fd.get("agenda") === "on" && !!org && hasFeature(org, "todos");
  const toAgenda = (to: string, link: string | null, subject?: string) => {
    if (agenda) addAgendaItem(orgId, subject ? `${subject}: ${body}` : body, { source: `Message from ${user.display_name} to ${to}`, link, addedBy: user.id });
  };

  if (m[1] === "person") {
    const memberId = Number(m[3]);
    const privately = fd.get("private") === "on";
    if (!(await sendAnswer(author, memberId, body.slice(0, 1000), privately))) back("That person isn't in this ward.", to);
    const name = (db().prepare("SELECT display_name FROM members WHERE id = ?").get(memberId) as { display_name: string } | undefined)?.display_name ?? "a member";
    toAgenda(name, `/admin/replies/${memberId}${privately ? "?private=1" : ""}`);
    revalidatePath("/", "layout");
    // Open the conversation (in that organization), where any answer will show.
    redirect(`/admin/replies/${memberId}?org=${orgId}${privately ? "&private=1" : ""}&msg=${encodeURIComponent(agenda ? "Sent, and added to the next presidency meeting's agenda." : "Sent.")}#end`);
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
  const wardId = getOrg(orgId)?.ward_id ?? user.ward_id;
  const tz = getWard(wardId)?.timezone ?? user.ward.timezone;
  // A flyer (PDF or picture): kept with the ward, so only its members can open it.
  let flyer: { file: string; name: string } | undefined;
  if (hasFlyer) {
    if (file.size > 15_000_000) back("The flyer must be under 15 MB.", to);
    try {
      flyer = { file: await saveUpload(file), name: file.name.slice(0, 200) || "Flyer" };
    } catch {
      back("That kind of file can't be attached. Use a PDF or a picture (PNG, JPEG, GIF, WebP or an iPhone photo).", to);
    }
    db().prepare("INSERT INTO plan_files (name, ward_id, original_name, uploaded_by) VALUES (?, ?, ?, ?)").run(flyer.file, wardId, flyer.name, user.id);
  }
  const { count, push, email, text, reached } = await sendToAudience({ orgId, senderId: user.id, audience, title, body: body.slice(0, 2000), link, tz, flyer });
  revalidatePath("/", "layout");
  const label = audienceLabel(orgId, audience);
  toAgenda(audience === "everyone" ? "everyone" : audience.startsWith("group:") ? label : `the ${label.toLowerCase()}`, null, String(fd.get("title") || "").trim().slice(0, 120));
  const missed = count - reached;
  redirect(
    `/messages?tab=sent&msg=${encodeURIComponent(
      `Sent to ${count}: ${push} by notification, ${email} by email, ${text} by text${missed > 0 ? `. ${missed} couldn't be reached (notifications off and no texts or emails chosen)` : ""}.${agenda ? " Added to the next presidency meeting's agenda." : ""}`,
    )}`,
  );
}
