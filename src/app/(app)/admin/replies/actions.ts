"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { sendAnswer } from "@/lib/conversations";

export async function answerMember(fd: FormData) {
  const user = await requirePresidency();
  const memberId = Number(fd.get("member_id"));
  const ok = await sendAnswer(user, memberId, String(fd.get("body") || ""));
  revalidatePath("/admin", "layout");
  redirect(`/admin/replies/${memberId}?msg=${encodeURIComponent(ok ? "Sent." : "Write a message first.")}${ok ? "" : "&err=1"}#end`);
}
