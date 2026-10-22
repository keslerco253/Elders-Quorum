"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { markUnreachedDone } from "@/lib/unreached";

/** Someone told them another way: off the list (it shows who, under Recently handled). */
export async function toldThem(fd: FormData) {
  const user = await requirePresidency();
  markUnreachedDone(user.org_id, Number(fd.get("item_id")), user.id);
  revalidatePath("/", "layout");
  redirect("/admin/unreached?msg=" + encodeURIComponent("Marked as told. Thank you!"));
}
