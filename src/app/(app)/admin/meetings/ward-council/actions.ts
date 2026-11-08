"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { todayIn } from "@/lib/time";
import { isAgendaSection } from "@/lib/agenda-sections";
import { addCouncilItem, councilItemToAgenda, deleteCouncilItem, editCouncilItem, getCouncilItem, setShared } from "@/lib/ward-council";

function back(text: string, hash = ""): never {
  redirect(`/admin/meetings/ward-council?msg=${encodeURIComponent(text)}${hash ? `#${hash}` : ""}`);
}

/** Something to share at ward council, or something from it to pass on (maybe onto the next presidency meeting's agenda). */
export async function addCouncilItemAction(fd: FormData) {
  const user = await requirePresidency();
  const kind = fd.get("kind") === "from" ? "from" : "share";
  const body = String(fd.get("body") || "").trim();
  if (!body) back(kind === "share" ? "Write what you'd like to share first." : "Write what was shared first.", kind);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("council_date"))) ? String(fd.get("council_date")) : todayIn(user.ward.timezone);
  const id = addCouncilItem(user.org_id, kind, body, user.id, date);
  const section = String(fd.get("section") || "");
  const toAgenda = kind === "from" && fd.get("agenda") === "on";
  if (toAgenda) councilItemToAgenda(user.org_id, id, user.id, isAgendaSection(section) ? section : "presidency");
  revalidatePath("/admin", "layout");
  back(kind === "share" ? "Added to share at ward council." : toAgenda ? "Saved and added to the next presidency meeting's agenda." : "Saved.", kind);
}

export async function councilToAgendaAction(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("item_id"));
  if (!getCouncilItem(user.org_id, id)) back("That item no longer exists.");
  councilItemToAgenda(user.org_id, id, user.id);
  revalidatePath("/admin", "layout");
  back("Added to the next presidency meeting's agenda.", "from");
}

export async function setSharedAction(fd: FormData) {
  const user = await requirePresidency();
  const shared = fd.get("shared") === "1";
  setShared(user.org_id, Number(fd.get("item_id")), shared);
  revalidatePath("/admin/meetings/ward-council");
  back(shared ? "Marked shared." : "Back on the list to share.", "share");
}

export async function editCouncilItemAction(fd: FormData) {
  const user = await requirePresidency();
  editCouncilItem(user.org_id, Number(fd.get("item_id")), String(fd.get("body") || ""));
  revalidatePath("/admin/meetings/ward-council");
  back("Saved.", String(fd.get("kind")) === "from" ? "from" : "share");
}

export async function deleteCouncilItemAction(fd: FormData) {
  const user = await requirePresidency();
  deleteCouncilItem(user.org_id, Number(fd.get("item_id")));
  revalidatePath("/admin/meetings/ward-council");
  back("Deleted.", String(fd.get("kind")) === "from" ? "from" : "share");
}
