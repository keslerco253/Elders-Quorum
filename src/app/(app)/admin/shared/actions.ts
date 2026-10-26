"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import type { CurrentUser } from "@/lib/types";
import { db } from "@/lib/db";
import { getSignup } from "@/lib/signups";
import { canEditPlan, getPlan, ledOrgIds } from "@/lib/plans";
import { createShare, stopShare } from "@/lib/public-shares";

/**
 * A file this leader may share publicly: one they uploaded, a flyer in an organization
 * they lead, or a picture or PDF on a plan they can edit (not just any file in the ward).
 */
function fileOk(user: CurrentUser, file: string) {
  const d = db();
  const f = d.prepare("SELECT uploaded_by FROM plan_files WHERE name = ? AND ward_id = ?").get(file, user.ward_id) as { uploaded_by: number | null } | undefined;
  if (!f) return false;
  if (f.uploaded_by === user.id) return true;
  const led = ledOrgIds(user);
  if (led.length) {
    const inList = led.map(Number).join(",");
    for (const table of ["events", "signups", "todos", "messages"]) {
      if (d.prepare(`SELECT 1 FROM ${table} WHERE flyer_file = ? AND org_id IN (${inList})`).get(file)) return true;
    }
  }
  const plans = d.prepare("SELECT DISTINCT plan_id FROM plan_versions WHERE pdf_file = ? OR body LIKE '%' || ? || '%'").all(file, file) as { plan_id: number }[];
  return plans.some((p) => {
    const plan = getPlan(user.ward_id, p.plan_id);
    return !!plan && canEditPlan(user, plan);
  });
}

export async function createPublicShare(fd: FormData) {
  const user = await requirePresidency();
  const file = String(fd.get("file") || "");
  const signupId = Number(fd.get("signup_id")) || 0;
  const planId = Number(fd.get("plan_id")) || 0;
  const title = String(fd.get("title") || "").trim();
  const caption = String(fd.get("caption") || "").trim();
  if (fd.get("agree") !== "on") redirect(`/admin/shared/new?${new URLSearchParams({ file, signup: signupId ? String(signupId) : "", plan: planId ? String(planId) : "", title, caption, msg: "Please tick the box first." })}`);
  let token: string;
  if (planId) {
    const plan = getPlan(user.ward_id, planId);
    if (!plan || !canEditPlan(user, plan)) redirect("/admin/shared");
    token = createShare({ orgId: user.org_id, kind: "plan", planId, title, caption, createdBy: user.id });
  } else if (signupId) {
    if (!getSignup(user.org_id, signupId)) redirect("/admin/shared");
    token = createShare({ orgId: user.org_id, kind: "signup", signupId, title, caption, createdBy: user.id });
  } else {
    if (!file || !fileOk(user, file)) redirect("/admin/shared");
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
