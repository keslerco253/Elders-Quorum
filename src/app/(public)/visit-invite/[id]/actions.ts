"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { answerInvitation, getPlannedVisit, validInviteToken, type InviteAnswer } from "@/lib/planned-visits";
import { db } from "@/lib/db";

/** The member's answer to a visit invitation (private link, no sign-in needed). */
export async function replyToInvitation(fd: FormData) {
  const id = Number(fd.get("plan_id"));
  const token = String(fd.get("t") || "");
  const ward = db().prepare("SELECT org_id FROM planned_visits WHERE id = ?").get(id) as { org_id: number } | undefined;
  const plan = ward ? getPlannedVisit(ward.org_id, id) : undefined;
  if (!plan || !validInviteToken(id, plan.member_id, token)) redirect(`/visit-invite/${id}?t=${encodeURIComponent(token)}`);
  const answer = String(fd.get("answer")) as InviteAnswer;
  if (!["accepted", "new_time", "declined"].includes(answer)) redirect(`/visit-invite/${id}?t=${encodeURIComponent(token)}`);
  const reply = String(fd.get("reply") || "");
  if (answer === "new_time" && !reply.trim()) redirect(`/visit-invite/${id}?t=${encodeURIComponent(token)}&a=new_time&err=1`);
  await answerInvitation(plan, answer, reply);
  revalidatePath("/", "layout");
  redirect(`/visit-invite/${id}?t=${encodeURIComponent(token)}&done=${answer}`);
}
