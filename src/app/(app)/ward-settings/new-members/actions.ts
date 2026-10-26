"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWardAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { onlyLeaderOf, removeFromWard } from "@/lib/accounts";
import { markNewMemberReviewed } from "@/lib/new-members";

const PAGE = "/ward-settings/new-members";

function go(text: string, view?: string): never {
  redirect(`${PAGE}?${new URLSearchParams({ msg: text, ...(view ? { view } : {}) })}`);
}

/** They belong here: off the "To review" list. */
export async function newMemberLooksGood(fd: FormData) {
  const user = await requireWardAdmin();
  markNewMemberReviewed(user.ward_id, Number(fd.get("member_id")), user.id);
  revalidatePath(PAGE);
  revalidatePath("/admin");
  go("Marked as reviewed.", String(fd.get("view") || ""));
}

/** They don't belong in this ward: taken out of it (and its organizations). */
export async function removeNewMember(fd: FormData) {
  const user = await requireWardAdmin();
  const id = Number(fd.get("member_id"));
  const m = db()
    .prepare("SELECT m.display_name FROM members m JOIN ward_members wm ON wm.member_id = m.id AND wm.ward_id = ? WHERE m.id = ?")
    .get(user.ward_id, id) as { display_name: string } | undefined;
  const view = String(fd.get("view") || "");
  if (!m) go("They're no longer in the ward.", view);
  if (id === user.id) go("You can't remove yourself here.", view);
  if (onlyLeaderOf(id, user.ward_id).length) go(`${m.display_name} is the only presidency member of an organization. Give it another leader first.`, view);
  const deleted = removeFromWard(id, user.ward_id);
  revalidatePath("/", "layout");
  go(deleted ? `${m.display_name} was removed, and their account was deleted (they were in no other ward).` : `${m.display_name} was removed from ${user.ward.name}.`, view);
}
