"use server";

import { redirect } from "next/navigation";
import { removeTeacherNotes } from "@/lib/lesson-notes";
import { askToTeach, cancelRequest } from "@/lib/teaching-requests";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requirePresidency } from "@/lib/auth";
import { getLesson, markGeneralConferences, openLessonSundays } from "@/lib/lessons";
import { fetchTalkInfo } from "@/lib/talk-info";
import { notify } from "@/lib/notify";
import { formatDate, sundays, todayIn } from "@/lib/time";
import type { LessonKind, Member } from "@/lib/types";
import { wardMember } from "@/lib/orgs";

const KINDS: LessonKind[] = ["talk", "general_conference", "stake_conference"];
function go(path: string, text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`);
}

function refresh() {
  revalidatePath("/lessons", "layout");
  revalidatePath("/admin/lessons", "layout");
}

export async function addSundays(fd: FormData) {
  const user = await requireAdmin();
  const start = String(fd.get("start") || "");
  const weeks = Math.min(Math.max(Number(fd.get("weeks")) || 26, 1), 60);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) go("/admin/lessons", "Choose a start date.");
  const ins = db().prepare("INSERT OR IGNORE INTO lessons (org_id, date) VALUES (?, ?)");
  let added = 0;
  let conferences = 0;
  db().transaction(() => {
    for (const d of sundays(start, weeks)) added += ins.run(user.org_id, d).changes;
    conferences = markGeneralConferences(user.org_id, start);
  })();
  refresh();
  go(
    "/admin/lessons",
    `${added} Sundays added.${conferences ? ` ${conferences === 1 ? "General Conference was" : `${conferences} General Conference Sundays were`} marked for you (first Sunday of April and October).` : ""} Next, mark any Stake Conference Sundays and paste the talk links.`,
  );
}

export async function fillTalks(fd: FormData) {
  const user = await requireAdmin();
  const urls = String(fd.get("urls") || "")
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  if (!urls.length) go("/admin/lessons", "Paste at least one talk link.");
  // The next open Sundays from today, skipping any that already have a talk (or are General Conference).
  markGeneralConferences(user.org_id, todayIn(user.ward.timezone));
  const open = openLessonSundays(user.org_id, todayIn(user.ward.timezone)).slice(0, urls.length);
  const infos = await Promise.all(urls.slice(0, open.length).map((u) => fetchTalkInfo(u)));
  const upd = db().prepare("UPDATE lessons SET url = ?, title = CASE WHEN title = '' THEN ? ELSE title END, speaker = CASE WHEN speaker = '' THEN ? ELSE speaker END WHERE id = ?");
  db().transaction(() => open.forEach((l, i) => upd.run(urls[i], infos[i].title, infos[i].speaker, l.id)))();
  refresh();
  const extra = urls.length - open.length;
  const missingTitles = infos.filter((i) => !i.title).length;
  go(
    "/admin/lessons",
    `${open.length} lessons filled.` +
      (extra > 0 ? ` ${extra} links left over: add more Sundays first.` : "") +
      (missingTitles ? ` ${missingTitles} titles couldn't be looked up; please type them in.` : ""),
  );
}

export async function saveLesson(fd: FormData) {
  const user = await requireAdmin();
  const lesson = getLesson(user.org_id, Number(fd.get("item_id")));
  if (!lesson) redirect("/admin/lessons");
  const kind = KINDS.includes(fd.get("kind") as LessonKind) ? (fd.get("kind") as LessonKind) : "talk";
  const rawUrl = String(fd.get("url") || "").trim();
  // Only web links (never javascript: or data:).
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : rawUrl && !/^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? `https://${rawUrl}` : "";
  let title = String(fd.get("title") || "").trim();
  let speaker = String(fd.get("speaker") || "").trim();
  if (url && url !== lesson.url && (!title || !speaker)) {
    const info = await fetchTalkInfo(url);
    title ||= info.title;
    speaker ||= info.speaker;
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("date"))) ? String(fd.get("date")) : lesson.date;
  const d = db();
  // Moving it to a Sunday that already has a lesson (even a blank one) swaps the two.
  const other = date !== lesson.date ? (d.prepare("SELECT id, title FROM lessons WHERE org_id = ? AND date = ? AND id <> ?").get(user.org_id, date, lesson.id) as { id: number; title: string } | undefined) : undefined;
  d.transaction(() => {
    if (other) d.prepare("UPDATE lessons SET date = ? WHERE id = ?").run(`swap-${other.id}`, other.id);
    d.prepare("UPDATE lessons SET kind = ?, title = ?, speaker = ?, url = ?, date = ? WHERE id = ?").run(kind, title, speaker, url, date, lesson.id);
    if (other) d.prepare("UPDATE lessons SET date = ? WHERE id = ?").run(lesson.date, other.id);
  })();
  refresh();
  go(
    `/admin/lessons/${lesson.id}`,
    other
      ? `Lesson moved to ${formatDate(date, "short")}. ${other.title ? `"${other.title}" moved to` : "The blank Sunday it replaced is now"} ${formatDate(lesson.date, "short")}.`
      : date !== lesson.date
        ? `Lesson moved to ${formatDate(date, "short")}.`
        : "Lesson saved.",
  );
}

export async function assignTeacher(fd: FormData) {
  const user = await requirePresidency();
  const lesson = getLesson(user.org_id, Number(fd.get("lesson_id")));
  if (!lesson) redirect("/admin/lessons");
  const teacherId = Number(fd.get("teacher_id")) || null;
  const teacher = teacherId
    ? (() => { const m = wardMember(teacherId, user.org_id); return m?.status === "active" ? m : undefined; })()
    : undefined;
  if (teacherId && !teacher) go(`/admin/lessons/${lesson.id}`, "Choose a current member.");
  // The previous teacher's notes go with them.
  if (lesson.teacher_id && lesson.teacher_id !== (teacher?.id ?? null)) removeTeacherNotes(lesson.id, lesson.teacher_id);
  // A new teacher hasn't confirmed yet.
  db().prepare("UPDATE lessons SET teacher_id = ?, teacher_confirmed_at = CASE WHEN teacher_id IS ? THEN teacher_confirmed_at END WHERE id = ?").run(teacher?.id ?? null, teacher?.id ?? null, lesson.id);
  if (teacher && teacher.id !== lesson.teacher_id && fd.get("notify") !== "off") {
    await notify([{ ...teacher, org_id: user.org_id }], {
      title: `You're teaching in ${user.orgLabel}`,
      body: `Thank you for teaching on ${formatDate(lesson.date)}${lesson.title ? `: "${lesson.title}"` : ""}${lesson.speaker ? ` by ${lesson.speaker}` : ""}. You can post notes for everyone to read beforehand on the lesson page.`,
      url: `/lessons/${lesson.id}`,
    });
  }
  refresh();
  go(`/admin/lessons/${lesson.id}`, teacher ? `${teacher.display_name} is assigned and has been notified.` : "Teacher removed.");
}

export async function deleteLesson(fd: FormData) {
  const user = await requireAdmin();
  db().prepare("DELETE FROM lessons WHERE id = ? AND org_id = ?").run(Number(fd.get("item_id")), user.org_id);
  refresh();
  go("/admin/lessons", "Lesson deleted.");
}

/** Asks a member if they'll teach this lesson. */
export async function askTeacher(fd: FormData) {
  const user = await requirePresidency();
  const lessonId = Number(fd.get("lesson_id"));
  const error = await askToTeach(user, lessonId, Number(fd.get("member_id")), String(fd.get("message") || ""), todayIn(user.ward.timezone));
  refresh();
  go(`/admin/lessons/${lessonId}`, error ?? "Request sent. You'll be notified when they answer.");
}

export async function cancelTeachingRequest(fd: FormData) {
  const user = await requirePresidency();
  cancelRequest(user.org_id, Number(fd.get("item_id")));
  refresh();
  go(`/admin/lessons/${Number(fd.get("lesson_id"))}`, "Request withdrawn.");
}
