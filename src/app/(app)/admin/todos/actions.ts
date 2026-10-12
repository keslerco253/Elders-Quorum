"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";
import { notify, type Recipient } from "@/lib/notify";
import { formatDate } from "@/lib/time";

function go(text: string): never {
  redirect(`/admin/todos?msg=${encodeURIComponent(text)}`);
}

export async function saveTodo(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("id")) || null;
  const title = String(fd.get("title") || "").trim().slice(0, 200);
  const notes = String(fd.get("notes") || "").trim().slice(0, 2000);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("due_date"))) ? String(fd.get("due_date")) : null;
  const assigneeId = Number(fd.get("assignee_id")) || null;
  if (!title) go("Give the assignment a title.");
  const assignee = assigneeId
    ? (db().prepare("SELECT id, email, display_name FROM members WHERE id = ? AND ward_id = ? AND role = 'presidency' AND status = 'active'").get(assigneeId, user.ward_id) as Recipient | undefined)
    : undefined;
  let previousAssignee: number | null = null;
  if (id) {
    const prev = db().prepare("SELECT assignee_id FROM todos WHERE id = ? AND ward_id = ?").get(id, user.ward_id) as { assignee_id: number | null } | undefined;
    if (!prev) go("That assignment no longer exists.");
    previousAssignee = prev.assignee_id;
    db().prepare("UPDATE todos SET title = ?, notes = ?, due_date = ?, assignee_id = ? WHERE id = ?").run(title, notes, due, assignee?.id ?? null, id);
  } else {
    db().prepare("INSERT INTO todos (ward_id, title, notes, due_date, assignee_id, created_by) VALUES (?, ?, ?, ?, ?, ?)").run(user.ward_id, title, notes, due, assignee?.id ?? null, user.id);
  }
  if (assignee && assignee.id !== user.id && assignee.id !== previousAssignee) {
    await notify([assignee], { title: "New presidency assignment", body: `${title}${due ? ` (due ${formatDate(due, "short")})` : ""}. Assigned by ${user.display_name}.`, url: "/admin/todos" });
  }
  revalidatePath("/admin/todos");
  go(id ? "Assignment updated." : "Assignment added.");
}

export async function toggleTodo(fd: FormData) {
  const user = await requirePresidency();
  const done = fd.get("done") === "1" ? 1 : 0;
  db().prepare("UPDATE todos SET done = ?, done_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ? AND ward_id = ?").run(done, done, Number(fd.get("id")), user.ward_id);
  revalidatePath("/admin/todos");
  redirect("/admin/todos");
}

export async function deleteTodo(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("DELETE FROM todos WHERE id = ? AND ward_id = ?").run(Number(fd.get("id")), user.ward_id);
  revalidatePath("/admin/todos");
  go("Assignment deleted.");
}
