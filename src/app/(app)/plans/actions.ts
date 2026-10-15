"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { allowedAudience, canCreatePlans, canEditPlan, createPlan, currentVersion, deletePlan, getPlan, managesWardPlans, saveVersion, setAudience } from "@/lib/plans";
import { saveUpload } from "@/lib/uploads";
import { audienceMembers, notify, type Recipient } from "@/lib/notify";
import { wardOrg } from "@/lib/orgs";

function back(path: string, msg: string): never {
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}

/** The attachment (PDF or picture) to keep with this version: a new upload, the previous one, or none. */
async function pdfFor(fd: FormData, prev: { pdf_file: string | null; pdf_name: string | null } | undefined, path: string) {
  let pdfFile = fd.get("remove_pdf") === "on" ? null : (prev?.pdf_file ?? null);
  let pdfName = pdfFile ? (prev?.pdf_name ?? null) : null;
  const file = fd.get("pdf");
  if (file instanceof File && file.size > 0) {
    if (file.size > 10_000_000) back(path, "The file must be under 10 MB.");
    try {
      pdfFile = await saveUpload(file);
      pdfName = file.name;
    } catch {
      back(path, "That kind of file can't be attached. Use a PDF or a picture (PNG, JPEG, GIF, WebP or an iPhone photo).");
    }
  }
  return { pdfFile, pdfName };
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
  const { pdfFile, pdfName } = await pdfFor(fd, undefined, "/plans/new");
  const id = createPlan(user.ward_id, title, audience, user.id);
  saveVersion({ planId: id, orgId: user.org_id, title, body: String(fd.get("body") || "").slice(0, 100_000), pdfFile, pdfName, createdBy: user.id });
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
  const { pdfFile, pdfName } = await pdfFor(fd, currentVersion(plan.id), path);
  saveVersion({ planId: plan.id, orgId: user.org_id, title, body: String(fd.get("body") || "").slice(0, 100_000), pdfFile, pdfName, createdBy: user.id });
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
