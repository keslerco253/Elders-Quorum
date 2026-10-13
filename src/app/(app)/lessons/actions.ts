"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getLesson } from "@/lib/lessons";
import { audienceMembers, notify } from "@/lib/notify";
import { formatDate } from "@/lib/time";
import { isAdmin } from "@/lib/permissions";
import { getNotes, publishNotes, submitNotes } from "@/lib/lesson-notes";
import { announceNotes } from "@/lib/notes-notify";
import { confirmTeaching, declineTeaching } from "@/lib/teaching";

const back = (id: number, text: string, anchor = "") => redirect(`/lessons/${id}?msg=${encodeURIComponent(text)}${anchor}`);

export async function volunteer(fd: FormData) {
  const user = await requireUser();
  const lesson = getLesson(user.ward_id, Number(fd.get("lesson_id")));
  if (!lesson || lesson.kind !== "talk") redirect("/lessons");
  if (fd.get("withdraw")) {
    db().prepare("DELETE FROM lesson_volunteers WHERE lesson_id = ? AND member_id = ?").run(lesson.id, user.id);
    revalidatePath(`/lessons/${lesson.id}`);
    back(lesson.id, "You've withdrawn your offer to teach.");
  }
  const r = db().prepare("INSERT OR IGNORE INTO lesson_volunteers (lesson_id, member_id) VALUES (?, ?)").run(lesson.id, user.id);
  if (r.changes) {
    await notify(audienceMembers(user.ward_id, "presidency"), {
      title: "Teaching volunteer",
      body: `${user.display_name} volunteered to teach on ${formatDate(lesson.date, "short")}${lesson.title ? ` ("${lesson.title}")` : ""}.`,
      url: `/admin/lessons/${lesson.id}`,
    });
  }
  revalidatePath(`/lessons/${lesson.id}`);
  back(lesson.id, "Thank you! The presidency will let you know who is assigned.");
}

/** The assigned teacher can't teach: they're taken off the lesson and the presidency is told why. */
export async function cantTeach(fd: FormData) {
  const user = await requireUser();
  const lesson = getLesson(user.ward_id, Number(fd.get("lesson_id")));
  if (!lesson || lesson.teacher_id !== user.id) redirect("/lessons");
  await declineTeaching(user, lesson, String(fd.get("reason") || ""));
  revalidatePath("/", "layout");
  back(lesson.id, "Thanks for letting us know. The presidency has been told and will find another teacher.");
}

/** The assigned teacher confirms they're still teaching. */
export async function confirmTeach(fd: FormData) {
  const user = await requireUser();
  const lesson = getLesson(user.ward_id, Number(fd.get("lesson_id")));
  if (!lesson || lesson.teacher_id !== user.id) redirect("/lessons");
  confirmTeaching(lesson.id, user.id);
  revalidatePath("/", "layout");
  back(lesson.id, "Thanks for confirming. See you Sunday!");
}

export async function addComment(fd: FormData) {
  const user = await requireUser();
  const lesson = getLesson(user.ward_id, Number(fd.get("lesson_id")));
  if (!lesson) redirect("/lessons");
  const body = String(fd.get("body") || "").trim().slice(0, 4000);
  if (!body) back(lesson.id, "Please write something first.");
  let parentId: number | null = Number(fd.get("parent_id")) || null;
  if (parentId) {
    const parent = db().prepare("SELECT parent_id FROM comments WHERE id = ? AND lesson_id = ? AND status = 'approved'").get(parentId, lesson.id) as { parent_id: number | null } | undefined;
    // Replies stay one level deep: replying to a reply joins the same thread.
    parentId = parent ? (parent.parent_id ?? parentId) : null;
  }
  db().prepare("INSERT INTO comments (lesson_id, parent_id, member_id, body) VALUES (?, ?, ?, ?)").run(lesson.id, parentId, user.id, body);
  await notify(
    audienceMembers(user.ward_id, "admins").filter((m) => m.id !== user.id),
    { title: "Comment waiting for approval", body: `${user.display_name}: ${body.slice(0, 120)}${body.length > 120 ? "…" : ""}`, url: "/admin/comments" },
  );
  revalidatePath(`/lessons/${lesson.id}`);
  back(lesson.id, "Thanks for sharing! Your comment will appear after the presidency approves it.", "#comments");
}

export async function deleteOwnComment(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("item_id"));
  const c = db().prepare("SELECT lesson_id FROM comments WHERE id = ? AND member_id = ?").get(id, user.id) as { lesson_id: number } | undefined;
  if (!c) redirect("/lessons");
  db().prepare("DELETE FROM comments WHERE id = ?").run(id);
  revalidatePath(`/lessons/${c.lesson_id}`);
  back(c.lesson_id, "Comment deleted.", "#comments");
}

export async function saveTeacherNotes(fd: FormData) {
  const user = await requireUser();
  const lesson = getLesson(user.ward_id, Number(fd.get("lesson_id")));
  if (!lesson || lesson.kind !== "talk") redirect("/lessons");
  const admin = isAdmin(user);
  if (lesson.teacher_id !== user.id && !admin) back(lesson.id, "Only this lesson's teacher can post notes.");
  const body = String(fd.get("notes") || "").trim().slice(0, 10_000);
  if (!body) back(lesson.id, "Please write your notes first.", "#notes");
  const existing = getNotes(lesson.id);
  // Keep the teacher as the author when an admin fixes their notes.
  submitNotes(lesson.id, existing?.author_id ?? user.id, body);

  if (admin) {
    // An admin's own save counts as approval.
    const first = publishNotes(lesson.id, user.id);
    const teacherName = getNotes(lesson.id)?.author ?? user.display_name;
    if (first) await announceNotes(user.ward_id, lesson, teacherName);
    revalidatePath(`/lessons/${lesson.id}`);
    back(lesson.id, first ? "Notes posted, and the quorum has been notified." : "Notes updated.", "#notes");
  }

  await notify(
    audienceMembers(user.ward_id, "admins").filter((m) => m.id !== user.id),
    { title: "Teacher notes to approve", body: `${user.display_name} posted notes for ${formatDate(lesson.date, "short")}. Approve them to share with the quorum.`, url: "/admin/notes" },
  );
  revalidatePath(`/lessons/${lesson.id}`);
  back(lesson.id, "Thanks! Your notes will be shared with the quorum once a member of the presidency approves them.", "#notes");
}
