"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { moveHomeSection, resetHomeLayout, setHomeSectionHidden } from "@/lib/home-layout";

export async function moveSection(fd: FormData) {
  const user = await requireUser();
  moveHomeSection(user.id, String(fd.get("key")), fd.get("dir") === "up" ? -1 : 1);
  revalidatePath("/more/home");
  revalidatePath("/");
}

export async function toggleSection(fd: FormData) {
  const user = await requireUser();
  setHomeSectionHidden(user.id, String(fd.get("key")), fd.get("hide") === "1");
  revalidatePath("/more/home");
  revalidatePath("/");
}

export async function resetLayout() {
  const user = await requireUser();
  resetHomeLayout(user.id);
  revalidatePath("/");
  redirect("/more/home?msg=" + encodeURIComponent("Home is back to the usual order."));
}
