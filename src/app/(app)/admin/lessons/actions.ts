"use server";

import { redirect } from "next/navigation";
import { removeTeacherNotes } from "@/lib/lesson-notes";
import { askToTeach, cancelRequest } from "@/lib/teaching-requests";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requirePresidency } from "@/lib/auth";
import { getLesson, markFifthSundays, markGeneralConferences, openLessonSundays } from "@/lib/lessons";
import { fallbackTitle, fetchTalkInfo, fetchTalkInfos } from "@/lib/talk-info";
import { notify, recipientById } from "@/lib/notify";
import { formatDate, sundays, todayIn } from "@/lib/time";
import type { LessonKind, Member } from "@/lib/types";
import { wardMember } from "@/lib/orgs";
import { refillCfmLesson, usesCfm } from "@/lib/cfm";
import { fillRegularTeachers, saveRegularTeachers, tellRegularTeachers, weeksText } from "@/lib/regular-teachers";
import { orgRoster } from "@/lib/orgs";

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
    // 5th Sundays get a 5th Sunday lesson (not a talk), to fill in when it's decided.
    if (!usesCfm(user.org)) markFifthSundays(user.org_id, start);
  })();
  fillRegularTeachers(user.org_id, todayIn(user.ward.timezone));
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
  const infos = await fetchTalkInfos(urls.slice(0, open.length));
  // What's there now is replaced: an old link (or speaker) left from a talk that was moved or cleared.
  const upd = db().prepare("UPDATE lessons SET url = ?, title = ?, speaker = ? WHERE id = ? AND trim(title) = ''");
  db().transaction(() => open.forEach((l, i) => upd.run(urls[i], infos[i].title || fallbackTitle(urls[i]), infos[i].speaker, l.id)))();
  refresh();
  const extra = urls.length - open.length;
  const missingTitles = infos.filter((i) => !i.title).length;
  go(
    "/admin/lessons",
    `${open.length} lessons filled.` +
      (extra > 0 ? ` ${extra} links left over: add more Sundays first.` : "") +
      (missingTitles ? ` ${missingTitles} titles couldn't be looked up, so they say "General Conference talk": open those lessons to type the title.` : ""),
  );
}

export async function saveLesson(fd: FormData) {
  const user = await requireAdmin();
  const lesson = getLesson(user.org_id, Number(fd.get("item_id")));
  if (!lesson) redirect("/admin/lessons");
  // An assigned topic, or a 5th Sunday lesson, is a lesson (kind talk) marked as one.
  const topic = fd.get("kind") === "topic" ? 1 : 0;
  const fifth = fd.get("kind") === "fifth" ? 1 : 0;
  const kind = KINDS.includes(fd.get("kind") as LessonKind) ? (fd.get("kind") as LessonKind) : "talk";
  // A 5th Sunday lesson can need no teacher (the area presidency, the stake...).
  const noTeacher = fifth && fd.get("no_teacher") === "on" ? 1 : 0;
  const rawUrl = String(fd.get("url") || "").trim();
  // Only web links (never javascript: or data:).
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : rawUrl && !/^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? `https://${rawUrl}` : "";
  let title = String(fd.get("title") || "").trim();
  let speaker = String(fd.get("speaker") || "").trim();
  if (!topic && !fifth && url && url !== lesson.url && (!title || !speaker)) {
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
    // Changed by hand: a Come, Follow Me lesson is no longer updated from the schedule.
    const handEdited = kind !== lesson.kind || topic !== lesson.topic || title !== lesson.title || speaker !== lesson.speaker || url !== lesson.url || date !== lesson.date;
    d.prepare("UPDATE lessons SET kind = ?, topic = ?, fifth = ?, no_teacher = ?, title = ?, speaker = ?, url = ?, date = ?, cfm_auto = cfm_auto * ? WHERE id = ?").run(
      kind,
      topic,
      kind === "talk" ? fifth : 0,
      kind === "talk" ? noTeacher : 0,
      title,
      speaker,
      url,
      date,
      handEdited ? 0 : 1,
      lesson.id,
    );
    if (other) d.prepare("UPDATE lessons SET date = ?, cfm_auto = 0 WHERE id = ?").run(lesson.date, other.id);
  })();
  // No teacher needed now: whoever was teaching is taken off and told.
  let tookOff = "";
  if (noTeacher && lesson.teacher_id) {
    d.prepare("UPDATE lessons SET teacher_id = NULL, teacher_confirmed_at = NULL, teacher_auto = 0 WHERE id = ?").run(lesson.id);
    removeTeacherNotes(lesson.id, lesson.teacher_id);
    const was = recipientById(lesson.teacher_id, user.org_id);
    if (was) await notify([was], { title: "You're not teaching after all", body: `No teacher is needed on ${formatDate(lesson.date, "short")}${title ? ` (${title})` : ""}. Thank you for being willing.`, url: `/lessons/${lesson.id}` });
    tookOff = ` ${lesson.teacher_name ?? "The teacher"} was taken off and told.`;
  }
  if (tookOff) {
    refresh();
    go(`/admin/lessons/${lesson.id}`, `Lesson saved. No teacher needed.${tookOff}`);
  }
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

export async function refillFromCfm(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("item_id"));
  const ok = refillCfmLesson(user.org_id, id);
  refresh();
  go(`/admin/lessons/${id}`, ok ? "Back to this week's Come, Follow Me lesson." : "There's no Come, Follow Me lesson for this Sunday.");
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
  // Set by hand: the regular teacher doesn't fill it again.
  db()
    .prepare("UPDATE lessons SET teacher_id = ?, teacher_confirmed_at = CASE WHEN teacher_id IS ? THEN teacher_confirmed_at END, teacher_auto = CASE WHEN teacher_id IS ? THEN teacher_auto ELSE 0 END, regular_done = 1 WHERE id = ?")
    .run(teacher?.id ?? null, teacher?.id ?? null, teacher?.id ?? null, lesson.id);
  if (teacher && teacher.id !== lesson.teacher_id && fd.get("notify") !== "off") {
    await notify([{ ...teacher, org_id: user.org_id }], {
      title: `You're teaching in ${user.orgLabel}`,
      body: `Thank you for teaching on ${formatDate(lesson.date)}${lesson.title ? `: "${lesson.title}"` : ""}${lesson.speaker ? ` by ${lesson.speaker}` : ""}. You can post notes for everyone to read beforehand on the lesson page.`,
      url: `/lessons/${lesson.id}`,
    }, { followUp: { what: `Assigned to teach on ${formatDate(lesson.date, "short")}`, url: `/admin/lessons/${lesson.id}` } });
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

/** Regular teachers: who teaches each 1st-4th Sunday of the month. */
export async function saveRegular(fd: FormData) {
  const user = await requirePresidency();
  const roster = new Set(orgRoster(user.org_id).map((p) => p.id));
  const byWeek = [1, 2, 3, 4].map((w) => {
    const id = Number(fd.get(`week${w}`)) || null;
    return id && roster.has(id) ? id : null;
  });
  const { added, removed, filled, changed } = saveRegularTeachers(user.org_id, byWeek, todayIn(user.ward.timezone));
  await tellRegularTeachers(user.org_id, user.orgLabel, { added, removed });
  refresh();
  go("/admin/lessons", changed ? `Regular teachers saved.${filled ? ` ${filled} upcoming lesson${filled === 1 ? "" : "s"} filled.` : ""}${added.length + removed.length ? " Teachers added or changed were notified." : ""}` : "No changes.");
}
