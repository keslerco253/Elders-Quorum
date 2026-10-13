"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requirePresidency } from "@/lib/auth";
import { getLesson } from "@/lib/lessons";
import { fetchTalkInfo } from "@/lib/talk-info";
import { notify } from "@/lib/notify";
import { formatDate, sundays } from "@/lib/time";
import type { LessonKind, Member } from "@/lib/types";

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
  const ins = db().prepare("INSERT OR IGNORE INTO lessons (ward_id, date) VALUES (?, ?)");
  let added = 0;
  db().transaction(() => {
    for (const d of sundays(start, weeks)) added += ins.run(user.ward_id, d).changes;
  })();
  refresh();
  go("/admin/lessons", `${added} Sundays added. Next, mark conference Sundays and paste the talk links.`);
}

export async function fillTalks(fd: FormData) {
  const user = await requireAdmin();
  const from = String(fd.get("from") || "");
  const urls = String(fd.get("urls") || "")
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  if (!urls.length) go("/admin/lessons", "Paste at least one talk link.");
  const open = db()
    .prepare("SELECT id, date FROM lessons WHERE ward_id = ? AND date >= ? AND kind = 'talk' AND url = '' ORDER BY date LIMIT ?")
    .all(user.ward_id, from || "0000-00-00", urls.length) as { id: number; date: string }[];
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
  const lesson = getLesson(user.ward_id, Number(fd.get("item_id")));
  if (!lesson) redirect("/admin/lessons");
  const kind = KINDS.includes(fd.get("kind") as LessonKind) ? (fd.get("kind") as LessonKind) : "talk";
  const url = String(fd.get("url") || "").trim();
  let title = String(fd.get("title") || "").trim();
  let speaker = String(fd.get("speaker") || "").trim();
  if (url && url !== lesson.url && (!title || !speaker)) {
    const info = await fetchTalkInfo(url);
    title ||= info.title;
    speaker ||= info.speaker;
  }
  const date = String(fd.get("date") || lesson.date);
  try {
    db().prepare("UPDATE lessons SET kind = ?, title = ?, speaker = ?, url = ?, date = ? WHERE id = ?").run(kind, title, speaker, url, date, lesson.id);
  } catch {
    go(`/admin/lessons/${lesson.id}`, "There's already a lesson on that date.");
  }
  refresh();
  go(`/admin/lessons/${lesson.id}`, "Lesson saved.");
}

export async function assignTeacher(fd: FormData) {
  const user = await requirePresidency();
  const lesson = getLesson(user.ward_id, Number(fd.get("lesson_id")));
  if (!lesson) redirect("/admin/lessons");
  const teacherId = Number(fd.get("teacher_id")) || null;
  const teacher = teacherId
    ? (db().prepare("SELECT * FROM members WHERE id = ? AND ward_id = ? AND status = 'active'").get(teacherId, user.ward_id) as Member | undefined)
    : undefined;
  if (teacherId && !teacher) go(`/admin/lessons/${lesson.id}`, "Choose a current member.");
  db().prepare("UPDATE lessons SET teacher_id = ? WHERE id = ?").run(teacher?.id ?? null, lesson.id);
  if (teacher && teacher.id !== lesson.teacher_id && fd.get("notify") !== "off") {
    await notify([teacher], {
      title: "You're teaching in elders quorum",
      body: `Thank you for teaching on ${formatDate(lesson.date)}${lesson.title ? `: "${lesson.title}"` : ""}${lesson.speaker ? ` by ${lesson.speaker}` : ""}. You can post notes for the quorum to read beforehand on the lesson page.`,
      url: `/lessons/${lesson.id}`,
    });
  }
  refresh();
  go(`/admin/lessons/${lesson.id}`, teacher ? `${teacher.display_name} is assigned and has been notified.` : "Teacher removed.");
}

export async function deleteLesson(fd: FormData) {
  const user = await requireAdmin();
  db().prepare("DELETE FROM lessons WHERE id = ? AND ward_id = ?").run(Number(fd.get("item_id")), user.ward_id);
  refresh();
  go("/admin/lessons", "Lesson deleted.");
}
