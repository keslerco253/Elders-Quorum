"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { endSession, requireUser } from "@/lib/auth";
import { deleteAccount, isLastPresidency } from "@/lib/accounts";

export async function setTheme(fd: FormData) {
  const user = await requireUser();
  const theme = String(fd.get("theme"));
  if (!["system", "light", "dark"].includes(theme)) return;
  db().prepare("UPDATE members SET theme = ? WHERE id = ?").run(theme, user.id);
  revalidatePath("/", "layout");
}

export async function deleteMyAccount(fd: FormData) {
  const user = await requireUser();
  if (fd.get("confirm") !== "DELETE") redirect("/more?msg=" + encodeURIComponent("Type DELETE to confirm."));
  if (isLastPresidency(user.ward_id, user.id)) {
    redirect("/more?msg=" + encodeURIComponent("You're the only presidency member. Give someone else presidency access first."));
  }
  await endSession();
  deleteAccount(user.id);
  redirect("/login?ok=" + encodeURIComponent("Your account and everything you posted have been deleted."));
}
