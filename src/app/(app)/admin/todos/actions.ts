"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";
import { notify, RECIPIENT_COLUMNS, type Recipient } from "@/lib/notify";
import { formatDate, todayIn } from "@/lib/time";
import { setTodoStatus, type TodoStatus } from "@/lib/assignments";
import { withOrg } from "@/lib/org-cookie";

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
  if (id) {
    const prev = db().prepare("SELECT assignee_id FROM todos WHERE id = ? AND org_id = ?").get(id, user.org_id) as { assignee_id: number | null } | undefined;
    if (!prev) go(back, "That assignment no longer exists.");
    previousAssignee = prev.assignee_id;
    db().prepare("UPDATE todos SET title = ?, notes = ?, due_date = ?, assignee_id = ?, reminder1_days = ?, reminder2_days = ? WHERE id = ?").run(title, notes, due, assignee?.id ?? null, r1, r2, id);
  } else {
    todoId = Number(
      db()
        .prepare("INSERT INTO todos (org_id, title, notes, due_date, assignee_id, created_by, meeting_id, reminder1_days, reminder2_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(user.org_id, title, notes, due, assignee?.id ?? null, user.id, meeting?.id ?? null, r1, r2).lastInsertRowid,
    );
  }
  if (assignee && assignee.id !== user.id && assignee.id !== previousAssignee) {
    await notify([assignee], {
      title: "New assignment",
      body: `${title}${due ? ` (due ${formatDate(due, "short")})` : ""}. From ${user.display_name}.`,
      url: withOrg(`/assignments/${todoId}`, user.org_id),
    });
  }
  revalidatePath("/", "layout");
  go(back, id ? "Assignment updated." : assignee && assignee.id !== user.id ? `Assignment added. ${assignee.display_name} was notified.` : "Assignment added.");
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

export async function deleteTodo(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("DELETE FROM todos WHERE id = ? AND org_id = ?").run(Number(fd.get("item_id")), user.org_id);
  revalidatePath("/", "layout");
  go(backTo(fd), "Assignment deleted.");
}
