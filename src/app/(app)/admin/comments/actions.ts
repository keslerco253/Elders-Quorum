"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

function safeReturn(v: FormDataEntryValue | null) {
  const s = String(v || "/admin/comments");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/admin/comments";
}

export async function moderateComment(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("id"));
  const status = fd.get("decision") === "approve" ? "approved" : "rejected";
  db()
    .prepare(
      `UPDATE comments SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ? AND lesson_id IN (SELECT id FROM lessons WHERE ward_id = ?)`,
    )
    .run(status, user.id, id, user.ward_id);
  revalidatePath("/admin/comments");
  revalidatePath("/lessons", "layout");
  redirect(safeReturn(fd.get("return")));
}

export async function approveAll() {
  const user = await requireAdmin();
  db()
    .prepare(
      `UPDATE comments SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now')
       WHERE status = 'pending' AND lesson_id IN (SELECT id FROM lessons WHERE ward_id = ?)`,
    )
    .run(user.id, user.ward_id);
  revalidatePath("/admin/comments");
  redirect("/admin/comments?msg=All%20comments%20approved.");
}
