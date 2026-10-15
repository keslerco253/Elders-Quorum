"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { templateDef } from "@/lib/template-defs";
import { resetTemplate, saveTemplate } from "@/lib/templates";

const back = (key: string, msg: string): never => redirect(`/admin/templates?open=${key}&msg=${encodeURIComponent(msg)}#${key}`);

export async function saveMessageTemplate(fd: FormData) {
  const user = await requirePresidency();
  const key = String(fd.get("key") || "");
  const def = templateDef(key);
  if (!def) redirect("/admin/templates");
  const title = def.title !== undefined ? String(fd.get("title") || "").trim().slice(0, 120) : null;
  const body = String(fd.get("body") || "").trim().slice(0, 800);
  if (!body || (def.title !== undefined && !title)) back(key, "The message can't be blank. Use Reset to go back to the app's wording.");
  saveTemplate(user.org_id, key, title, body, user.id);
  revalidatePath("/admin/templates");
  back(key, `Saved: ${def.label}.`);
}

export async function resetMessageTemplate(fd: FormData) {
  const user = await requirePresidency();
  const key = String(fd.get("key") || "");
  const def = templateDef(key);
  if (!def) redirect("/admin/templates");
  resetTemplate(user.org_id, key);
  revalidatePath("/admin/templates");
  back(key, `${def.label} is back to the app's wording.`);
}
