"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { allowedAudience, canCreatePlans, canEditPlan, createPlan, deletePlan, getPlan, managesWardPlans, saveVersion, setAudience, setPlanIcon, wardFileCheck } from "@/lib/plans";
import { saveUpload } from "@/lib/uploads";
import { db } from "@/lib/db";
import { isPicture } from "@/lib/upload-names";
import { parseBlocks, type Block } from "@/lib/plan-blocks";
import { audienceMembers, notify, type Recipient } from "@/lib/notify";
import { wardOrg } from "@/lib/orgs";

function back(path: string, msg: string): never {
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}

/** The page from the editor; files must have been uploaded to this ward. */
function readBlocks(fd: FormData, wardId: number): Block[] {
  return parseBlocks(String(fd.get("blocks") || "[]"), wardFileCheck(wardId));
}

/** "Whole ward" (no organizations) or the organizations ticked. */
function readAudience(fd: FormData): number[] {
  return fd.get("audience") === "ward" ? [] : fd.getAll("org_id").map(Number).filter(Boolean);
}

/** Lets everyone the plan is for know it changed. */
async function announce(wardId: number, orgIds: number[], title: string, planId: number) {
  const lists = orgIds.length ? orgIds.map((id) => audienceMembers(id, "everyone")) : [audienceMembers(wardOrg(wardId).id, "everyone")];
  const seen = new Set<number>();
  const recipients: Recipient[] = [];
  for (const r of lists.flat()) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    recipients.push(r);
  }
  await notify(recipients, { title: `${title} updated`, body: "Take a look at the updated plan in the app.", url: `/plans/${planId}` });
}

export async function createPlanAction(fd: FormData) {
  const user = await requireUser();
  if (!canCreatePlans(user)) redirect("/plans");
  const title = String(fd.get("title") || "").trim().slice(0, 120);
  if (!title) back("/plans/new", "Give the plan a title.");
  const audience = allowedAudience(user, readAudience(fd));
  if (audience === null || (!audience.length && !managesWardPlans(user))) back("/plans/new", "Choose which of your organizations this plan is for.");
  const id = createPlan(user.ward_id, title, audience, user.id);
  saveVersion({ planId: id, orgId: user.org_id, title, blocks: readBlocks(fd, user.ward_id), createdBy: user.id });
  if (fd.get("announce") === "on") await announce(user.ward_id, audience, title, id);
  revalidatePath("/plans", "layout");
  back(`/plans/${id}`, "Plan posted.");
}

export async function savePlanVersion(fd: FormData) {
  const user = await requireUser();
  const plan = getPlan(user.ward_id, Number(fd.get("plan_id")));
  if (!plan || !canEditPlan(user, plan)) redirect("/plans");
  const path = `/plans/${plan.id}/edit`;
  const title = String(fd.get("title") || "").trim().slice(0, 120) || plan.name;
  // Ward leaders can change who it's for; organization leaders keep it within theirs.
  let audience = plan.org_ids;
  if (fd.has("audience")) {
    const wanted = allowedAudience(user, readAudience(fd));
    if (wanted === null || (!wanted.length && !managesWardPlans(user))) back(path, "Choose which of your organizations this plan is for.");
    audience = wanted;
  }
  saveVersion({ planId: plan.id, orgId: user.org_id, title, blocks: readBlocks(fd, user.ward_id), createdBy: user.id });
  setAudience(plan.id, audience);
  if (fd.get("announce") === "on") await announce(user.ward_id, audience, title, plan.id);
  revalidatePath("/plans", "layout");
  back(`/plans/${plan.id}`, "Plan saved.");
}

export async function deletePlanAction(fd: FormData) {
  const user = await requireUser();
  const plan = getPlan(user.ward_id, Number(fd.get("plan_id")));
  if (!plan || !canEditPlan(user, plan)) redirect("/plans");
  deletePlan(plan.id);
  revalidatePath("/plans", "layout");
  back("/plans", `${plan.name} was deleted.`);
}

/** A plan's icon: a drawn one or an emoji, or an uploaded picture. */
export async function setPlanIconAction(fd: FormData) {
  const user = await requireUser();
  const plan = getPlan(user.ward_id, Number(fd.get("plan_id")));
  if (!plan || !canEditPlan(user, plan)) redirect("/plans");
  const back = (msg: string): never => redirect(`/plans/${plan.id}/edit?msg=${encodeURIComponent(msg)}#icon`);
  const file = fd.get("icon_file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5_000_000) back("The icon picture must be under 5 MB.");
    let name = "";
    try {
      name = await saveUpload(file);
    } catch {
      back("Use a picture (PNG, JPEG, GIF, WebP or an iPhone photo) for the icon.");
    }
    if (!isPicture(name)) back("Use a picture (not a PDF) for the icon.");
    db().prepare("INSERT INTO plan_files (name, ward_id, original_name, uploaded_by) VALUES (?, ?, ?, ?)").run(name, user.ward_id, "Plan icon", user.id);
    setPlanIcon(plan.id, { file: name });
  } else {
    setPlanIcon(plan.id, { key: String(fd.get("icon") || "") });
  }
  revalidatePath("/plans");
  redirect(`/plans/${plan.id}/edit?ok=1&msg=${encodeURIComponent("Icon saved.")}#icon`);
}
