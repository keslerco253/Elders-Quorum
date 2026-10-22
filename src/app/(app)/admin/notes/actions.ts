"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getLesson } from "@/lib/lessons";
import { getNotes, publishNotes, rejectNotes } from "@/lib/lesson-notes";
import { announceNotes } from "@/lib/notes-notify";
import { notify, recipientById } from "@/lib/notify";
import { formatDate } from "@/lib/time";

function go(text: string): never {
  redirect(`/admin/notes?msg=${encodeURIComponent(text)}`);
}

export async function reviewNotes(fd: FormData) {
  const user = await requireAdmin();
  const lesson = getLesson(user.org_id, Number(fd.get("lesson_id")));
  const notes = lesson && getNotes(lesson.id);
  if (!lesson || !notes || notes.status !== "pending") go("Those notes were already handled.");
  const teacher = recipientById(notes.author_id, user.org_id);

  if (fd.get("decision") === "approve") {
    const first = publishNotes(lesson.id, user.id);
    if (first) await announceNotes(user.org_id, lesson, notes.author ?? "Your teacher");
    revalidatePath(`/lessons/${lesson.id}`);
    revalidatePath("/admin/notes");
    go(first ? "Approved. Everyone has been notified." : "Approved. The updated notes are now showing (no new notification).");
  }

  const reason = String(fd.get("note") || "").trim().slice(0, 500);
  rejectNotes(lesson.id, user.id, reason);
  if (teacher) {
    await notify([teacher], {
      title: "About your lesson notes",
      body: `Your notes for ${formatDate(lesson.date, "short")} weren't shared yet.${reason ? ` ${reason}` : ""} You can edit them on the lesson page.`,
      url: `/lessons/${lesson.id}#notes`,
    }, { followUp: { what: `Lesson notes sent back for ${formatDate(lesson.date, "short")}`, url: `/admin/lessons/${lesson.id}` } });
  }
  revalidatePath("/admin/notes");
  go("Sent back to the teacher.");
}
