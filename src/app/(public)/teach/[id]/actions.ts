"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { confirmTeaching, declineTeaching, lessonForTeacher, validTeachToken } from "@/lib/teaching";

/** A teacher's answer from the reply page their reminder links to (no sign-in needed). */
export async function respondTeaching(fd: FormData) {
  const id = Number(fd.get("lesson_id"));
  const token = String(fd.get("t") || "");
  const teacherId = Number(fd.get("teacher_id"));
  const lesson = lessonForTeacher(id);
  if (!lesson || lesson.teacher_id !== teacherId || !validTeachToken(id, teacherId, token)) redirect(`/teach/${id}?t=${encodeURIComponent(token)}`);
  if (fd.get("answer") === "cant") {
    const member = db().prepare("SELECT id, display_name FROM members WHERE id = ?").get(teacherId) as { id: number; display_name: string };
    await declineTeaching(member, lesson, String(fd.get("reason") || ""));
  } else {
    confirmTeaching(id, teacherId);
  }
  revalidatePath("/", "layout");
  redirect(`/teach/${id}?t=${encodeURIComponent(token)}&done=${fd.get("answer") === "cant" ? "cant" : "teach"}&m=${teacherId}`);
}
