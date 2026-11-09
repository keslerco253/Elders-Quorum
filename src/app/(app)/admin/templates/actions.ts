"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { fillTemplate, ONE_TEXT, TEXT_LINK_LENGTH, templateDef } from "@/lib/template-defs";
import { orgFullName } from "@/lib/orgs";
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
  let text: string | null = null;
  if (def.text !== undefined) {
    text = String(fd.get("text") || "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!text) back(key, "The text message can't be blank. Use Reset to go back to the app's wording.");
    const from = user.org.kind === "ward" ? orgFullName(user.org_id) : user.org.name;
    const letters = textLength(from, text, def.vars) + TEXT_LINK_LENGTH;
    if (letters > ONE_TEXT) back(key, `Not saved: the text message is ${letters} letters with the sample fill-ins, and it has to fit in ${ONE_TEXT}. Shorten it by ${letters - ONE_TEXT}.`);
  }
  saveTemplate(user.org_id, key, title, body, user.id, text);
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

/** A text's letters before its link: who it's from, then the wording with the sample fill-ins. */
function textLength(from: string, text: string, vars: { name: string; sample: string }[]): number {
  return `${from}: ${fillTemplate(text, Object.fromEntries(vars.map((v) => [v.name, v.sample])))}`.replace(/\s+/g, " ").trim().length;
}
