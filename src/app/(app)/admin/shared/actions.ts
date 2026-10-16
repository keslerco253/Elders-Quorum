"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignup } from "@/lib/signups";
import { createShare, stopShare } from "@/lib/public-shares";

/** A file this organization's leaders may share: one of the ward's uploads (plans, flyers). */
function fileOk(wardId: number, file: string) {
  return !!db().prepare("SELECT 1 FROM plan_files WHERE name = ? AND ward_id = ?").get(file, wardId);
}

export async function createPublicShare(fd: FormData) {
  const user = await requirePresidency();
  const file = String(fd.get("file") || "");
  const signupId = Number(fd.get("signup_id")) || 0;
  const title = String(fd.get("title") || "").trim();
  const caption = String(fd.get("caption") || "").trim();
  if (fd.get("agree") !== "on") redirect(`/admin/shared/new?${new URLSearchParams({ file, signup: signupId ? String(signupId) : "", title, caption, msg: "Please tick the box first." })}`);
  let token: string;
  if (signupId) {
    if (!getSignup(user.org_id, signupId)) redirect("/admin/shared");
    token = createShare({ orgId: user.org_id, kind: "signup", signupId, title, caption, createdBy: user.id });
  } else {
    if (!file || !fileOk(user.ward_id, file)) redirect("/admin/shared");
    token = createShare({ orgId: user.org_id, kind: "file", file, title, caption, createdBy: user.id });
  }
  revalidatePath("/admin/shared");
  redirect(`/admin/shared?new=${token}#${token}`);
}

export async function stopPublicShare(fd: FormData) {
  const user = await requirePresidency();
  stopShare(user.org_id, String(fd.get("token") || ""));
  revalidatePath("/admin/shared");
  redirect(`/admin/shared?msg=${encodeURIComponent("Stopped sharing. That link and QR code no longer work.")}`);
}
