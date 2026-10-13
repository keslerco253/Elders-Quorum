"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { sendAnswer } from "@/lib/conversations";

export async function answerMember(fd: FormData) {
  const user = await requirePresidency();
  const memberId = Number(fd.get("member_id"));
  const privately = fd.get("private") === "1";
  const ok = await sendAnswer(user, memberId, String(fd.get("body") || ""), privately);
  revalidatePath("/admin", "layout");
  redirect(`/admin/replies/${memberId}?${privately ? "private=1&" : ""}msg=${encodeURIComponent(ok ? "Sent." : "Write a message first.")}${ok ? "" : "&err=1"}#end`);
}
