"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function setTheme(fd: FormData) {
  const user = await requireUser();
  const theme = String(fd.get("theme"));
  if (!["system", "light", "dark"].includes(theme)) return;
  db().prepare("UPDATE members SET theme = ? WHERE id = ?").run(theme, user.id);
  revalidatePath("/", "layout");
}
