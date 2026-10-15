"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/notification-log";

/** Marks one notification read (tapping one that has nowhere to go), or all of them. */
export async function markRead(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("id")) || undefined;
  markNotificationsRead(user.id, id);
  revalidatePath("/", "layout");
}
