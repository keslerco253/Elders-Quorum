"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { addAgendaItem, createMeeting, finishMeeting, getMeeting, reviewRecord, type ReviewRecord } from "@/lib/meetings";
import { ledOrgIds } from "@/lib/conversations";
import { formatDate, todayIn } from "@/lib/time";

function go(path: string, text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`);
}

const meetingPath = (fd: FormData) => {
  const id = Number(fd.get("meeting_id"));
  return id ? `/admin/meetings/${id}` : "/admin/meetings";
};

export async function addAgenda(fd: FormData) {
  const user = await requirePresidency();
  const body = String(fd.get("body") || "").trim();
  if (!body) go(`${meetingPath(fd)}#agenda`, "Write the agenda item first.");
  addAgendaItem(user.org_id, body, { addedBy: user.id });
  revalidatePath("/admin", "layout");
  go(`${meetingPath(fd)}#agenda`, "Added to the agenda.");
}

export async function removeAgenda(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("DELETE FROM agenda_items WHERE id = ? AND org_id = ?").run(Number(fd.get("item_id")), user.org_id);
  revalidatePath("/admin", "layout");
  go(`${meetingPath(fd)}#agenda`, "Taken off the agenda.");
}

export async function toggleDiscussed(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("UPDATE agenda_items SET discussed = ? WHERE id = ? AND org_id = ?").run(fd.get("discussed") === "1" ? 1 : 0, Number(fd.get("item_id")), user.org_id);
  revalidatePath("/admin/meetings", "layout");
  redirect(`${meetingPath(fd)}#agenda`);
}

export async function newMeeting(fd: FormData) {
  const user = await requirePresidency();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("date"))) ? String(fd.get("date")) : todayIn(user.ward.timezone);
  const id = createMeeting(user.org_id, date, String(fd.get("title") || "").trim().slice(0, 120), user.id);
  revalidatePath("/admin/meetings");
  redirect(`/admin/meetings/${id}`);
}

export async function saveMeeting(fd: FormData) {
  const user = await requirePresidency();
  const m = getMeeting(user.org_id, Number(fd.get("meeting_id")));
  if (!m) go("/admin/meetings", "That meeting no longer exists.");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("date"))) ? String(fd.get("date")) : m.date;
  const attendees = [...fd.getAll("att").map(String), ...String(fd.get("att_other") || "").split(",")]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ")
    .slice(0, 500);
  db()
    .prepare("UPDATE meetings SET date = ?, title = ?, attendees = ?, notes = ?, updated_at = datetime('now') WHERE id = ?")
    .run(date, String(fd.get("title") || "").trim().slice(0, 120), attendees, String(fd.get("notes") ?? m.notes).slice(0, 20000), m.id);
  revalidatePath("/admin/meetings", "layout");
  go(`/admin/meetings/${m.id}`, "Notes saved.");
}

export async function finish(fd: FormData) {
  const user = await requirePresidency();
  const m = getMeeting(user.org_id, Number(fd.get("meeting_id")));
  if (!m) go("/admin/meetings", "That meeting no longer exists.");
  finishMeeting(user.org_id, m.id, todayIn(user.ward.timezone));
  revalidatePath("/admin", "layout");
  go(`/admin/meetings/${m.id}`, "Meeting finished. Items not discussed wait for the next meeting.");
}

export async function deleteMeeting(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("DELETE FROM meetings WHERE id = ? AND org_id = ?").run(Number(fd.get("meeting_id")), user.org_id);
  revalidatePath("/admin", "layout");
  go("/admin/meetings", "Meeting and its notes deleted.");
}

export async function reviewAction(fd: FormData) {
  const user = await requirePresidency();
  const kind = String(fd.get("kind")) as ReviewRecord["kind"];
  if (!["meeting", "todo", "agenda"].includes(kind)) go("/admin/meetings/review", "Choose a record.");
  const keep = fd.get("decision") === "keep";
  reviewRecord(user.org_id, kind, Number(fd.get("id")), keep, todayIn(user.ward.timezone));
  revalidatePath("/admin", "layout");
  go("/admin/meetings/review", keep ? "Kept. It will come up again in 3 months." : "Deleted.");
}

/** A member's message, put on the next presidency meeting's agenda (from the conversation). */
export async function agendaFromMessage(fd: FormData) {
  const user = await requirePresidency();
  const msg = db()
    .prepare("SELECT mm.id, mm.org_id, mm.member_id, mm.body, mm.created_at, m.display_name FROM member_messages mm JOIN members m ON m.id = mm.member_id WHERE mm.id = ? AND mm.direction = 'in'")
    .get(Number(fd.get("message_id"))) as { id: number; org_id: number; member_id: number; body: string; created_at: string; display_name: string } | undefined;
  const back = String(fd.get("back") || "/messages");
  const safeBack = back.startsWith("/admin/replies/") ? back : "/messages";
  if (!msg || !ledOrgIds(user.id).includes(msg.org_id)) go(safeBack, "That message can't be added.");
  addAgendaItem(msg.org_id, msg.body, { source: `Message from ${msg.display_name}, ${formatDate(msg.created_at.slice(0, 10), "short")}`, link: `/admin/replies/${msg.member_id}`, addedBy: user.id });
  revalidatePath("/admin", "layout");
  go(safeBack, "Added to the next presidency meeting's agenda.");
}
