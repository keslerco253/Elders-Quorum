"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency, requireUser } from "@/lib/auth";
import { notify, RECIPIENT_COLUMNS, type Recipient } from "@/lib/notify";
import { todayIn } from "@/lib/time";
import { dueText, getTodo, isPresidencyOf, setTodoStatus, type TodoStatus } from "@/lib/assignments";
import { saveUpload } from "@/lib/uploads";
import { unreachableWhy } from "@/lib/delivery";
import { withOrg } from "@/lib/org-cookie";
import { cancelPendingHandoffs } from "@/lib/assignment-handoffs";

/** Back to the meeting the form was on, or the assignments list. */
function backTo(fd: FormData): string {
  const b = String(fd.get("back") || "");
  return /^\/(admin\/(meetings\/\d+|todos)|assignments)(\?[\w=&]*)?$/.test(b) ? b : "/admin/todos";
}

function go(path: string, text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`);
}

export async function saveTodo(fd: FormData) {
  const user = await requirePresidency();
  const back = backTo(fd);
  const id = Number(fd.get("item_id")) || null;
  const title = String(fd.get("title") || "").trim().slice(0, 200);
  const notes = String(fd.get("notes") || "").trim().slice(0, 2000);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("due_date"))) ? String(fd.get("due_date")) : null;
  const dueTime = due && /^\d{2}:\d{2}$/.test(String(fd.get("due_time"))) ? String(fd.get("due_time")) : null;
  const assigneeId = Number(fd.get("assignee_id")) || null;
  const meetingId = Number(fd.get("meeting_id")) || null;
  // Reminders: days before it's due (0 = the morning it's due), or blank for none.
  const days = (name: string) => {
    const v = String(fd.get(name) ?? "");
    const n = Number(v);
    return v !== "" && Number.isInteger(n) && n >= 0 && n <= 30 ? n : null;
  };
  const r1 = days("reminder1_days");
  const r2 = days("reminder2_days");
  if (!title) go(back, "Give the assignment a title.");
  // Anyone in the organization (the presidency or any member).
  const assignee = assigneeId
    ? (db()
        .prepare(`SELECT ${RECIPIENT_COLUMNS} FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ? WHERE m.id = ? AND m.status = 'active'`)
        .get(user.org_id, user.org_id, assigneeId) as Recipient | undefined)
    : undefined;
  const meeting = meetingId ? (db().prepare("SELECT id FROM meetings WHERE id = ? AND org_id = ?").get(meetingId, user.org_id) as { id: number } | undefined) : undefined;
  let previousAssignee: number | null = null;
  let todoId = id;
  const prev = id
    ? (db().prepare("SELECT assignee_id, accept_status, flyer_file, flyer_name FROM todos WHERE id = ? AND org_id = ?").get(id, user.org_id) as
        | { assignee_id: number | null; accept_status: string; flyer_file: string | null; flyer_name: string | null }
        | undefined)
    : undefined;
  if (id && !prev) go(back, "That assignment no longer exists.");
  previousAssignee = prev?.assignee_id ?? null;
  // An attachment (a flyer, a handout): a new upload, the one it had, or none.
  let flyerFile = fd.get("remove_flyer") === "on" ? null : (prev?.flyer_file ?? null);
  let flyerName = flyerFile ? (prev?.flyer_name ?? null) : null;
  const file = fd.get("flyer");
  if (file instanceof File && file.size > 0) {
    if (file.size > 15_000_000) go(back, "The attachment must be under 15 MB.");
    try {
      flyerFile = await saveUpload(file);
      flyerName = file.name.slice(0, 200) || "Attachment";
      // Recorded with the ward, so only its members can open it.
      db().prepare("INSERT INTO plan_files (name, ward_id, original_name, uploaded_by) VALUES (?, ?, ?, ?)").run(flyerFile, user.ward_id, flyerName, user.id);
    } catch {
      go(back, "That kind of file can't be attached. Use a PDF or a picture (PNG, JPEG, GIF, WebP or an iPhone photo).");
    }
  }
  // Given to someone else, it's a request until they accept it.
  const newPerson = !!assignee && assignee.id !== previousAssignee;
  const asking = !!assignee && assignee.id !== user.id && newPerson;
  const acceptStatus = asking ? "pending" : !assignee || assignee.id === user.id ? "accepted" : (prev?.accept_status ?? "accepted");
  if (id) {
    db()
      .prepare(
        `UPDATE todos SET title = ?, notes = ?, due_date = ?, due_time = ?, assignee_id = ?, reminder1_days = ?, reminder2_days = ?, flyer_file = ?, flyer_name = ?,
           accept_status = ?, asked_at = CASE WHEN ? THEN datetime('now') ELSE asked_at END WHERE id = ?`,
      )
      .run(title, notes, due, dueTime, assignee?.id ?? null, r1, r2, flyerFile, flyerName, acceptStatus, asking ? 1 : 0, id);
    // Given to someone else by hand: an ask to take it no longer applies.
    if ((assignee?.id ?? null) !== previousAssignee) cancelPendingHandoffs(id);
  } else {
    todoId = Number(
      db()
        .prepare(
          `INSERT INTO todos (org_id, title, notes, due_date, due_time, assignee_id, created_by, meeting_id, reminder1_days, reminder2_days, flyer_file, flyer_name, accept_status, asked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN datetime('now') END)`,
        )
        .run(user.org_id, title, notes, due, dueTime, assignee?.id ?? null, user.id, meeting?.id ?? null, r1, r2, flyerFile, flyerName, acceptStatus, asking ? 1 : 0).lastInsertRowid,
    );
  }
  let reached = true;
  if (asking) {
    reached = (await notify([assignee!], {
      title: "Would you be willing to accept this assignment?",
      body: `${title}${due ? ` (due ${dueText(due, dueTime)})` : ""}. From ${user.display_name}. Tap to accept or let them know you can't.`,
      url: withOrg(`/assignments/${todoId}`, user.org_id),
      ...(flyerFile ? { attachment: { file: flyerFile, name: flyerName ?? "Attachment" } } : {}),
    }, { followUp: { what: `Assignment request: ${title}` } })).reached > 0;
  }
  revalidatePath("/", "layout");
  if (asking && !reached) go(back, `Saved, but ${assignee!.display_name} couldn't be reached (${unreachableWhy(assignee!.id)}). Please tell them in person or by phone. It's on the presidency's Couldn't reach list until someone does.`);
  go(back, asking ? `Sent to ${assignee!.display_name} to accept. It shows as not accepted until they say yes.` : id ? "Assignment updated." : "Assignment added.");
}

export async function setStatus(fd: FormData) {
  const user = await requirePresidency();
  const status = String(fd.get("status")) as TodoStatus;
  const id = Number(fd.get("item_id"));
  if (!["open", "progress", "done"].includes(status) || !db().prepare("SELECT 1 FROM todos WHERE id = ? AND org_id = ?").get(id, user.org_id)) go(backTo(fd), "That assignment no longer exists.");
  setTodoStatus(id, status, todayIn(user.ward.timezone));
  revalidatePath("/", "layout");
  redirect(backTo(fd));
}

/** Deletes an assignment and its progress notes (anyone in that organization's presidency). */
export async function deleteTodo(fd: FormData) {
  const user = await requireUser();
  const t = getTodo(Number(fd.get("item_id")));
  if (!t) go(backTo(fd), "That assignment no longer exists.");
  if (!isPresidencyOf(user.id, t.org_id)) go(backTo(fd), "Only that organization's presidency can delete it.");
  db().prepare("DELETE FROM todos WHERE id = ?").run(t.id);
  revalidatePath("/", "layout");
  go(backTo(fd), "Assignment deleted.");
}
