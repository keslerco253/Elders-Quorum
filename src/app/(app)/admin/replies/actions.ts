"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { ledOrgIds, markThreadUnread, sendAnswer } from "@/lib/conversations";
import type { CurrentUser } from "@/lib/types";

/** The organization the page was showing (it may not be the one now chosen on another device). */
function formOrg(user: CurrentUser, fd: FormData): number {
  const orgId = Number(fd.get("org_id")) || user.org_id;
  if (!ledOrgIds(user.id).includes(orgId)) redirect("/messages");
  return orgId;
}

export async function answerMember(fd: FormData) {
  const user = await requirePresidency();
  const memberId = Number(fd.get("member_id"));
  const privately = fd.get("private") === "1";
  const orgId = formOrg(user, fd);
  const ok = await sendAnswer({ id: user.id, org_id: orgId, display_name: user.display_name }, memberId, String(fd.get("body") || ""), privately);
  revalidatePath("/admin", "layout");
  redirect(`/admin/replies/${memberId}?org=${orgId}&${privately ? "private=1&" : ""}msg=${encodeURIComponent(ok ? "Sent." : "Write a message first.")}${ok ? "" : "&err=1"}#end`);
}

/** Like email: keep a conversation unread to come back to it. */
export async function markUnread(fd: FormData) {
  const user = await requirePresidency();
  const memberId = Number(fd.get("member_id"));
  markThreadUnread(formOrg(user, fd), memberId, fd.get("private") === "1" ? { private: true, withId: user.id } : { private: false }, user.id);
  revalidatePath("/", "layout");
  redirect("/messages");
}
