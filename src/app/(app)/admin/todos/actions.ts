"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";
import { notify, RECIPIENT_COLUMNS, type Recipient } from "@/lib/notify";
import { formatDate } from "@/lib/time";

function go(text: string): never {
  redirect(`/admin/todos?msg=${encodeURIComponent(text)}`);
}

export async function saveTodo(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("item_id")) || null;
  const title = String(fd.get("title") || "").trim().slice(0, 200);
  const notes = String(fd.get("notes") || "").trim().slice(0, 2000);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("due_date"))) ? String(fd.get("due_date")) : null;
  const assigneeId = Number(fd.get("assignee_id")) || null;
  if (!title) go("Give the assignment a title.");
  const assignee = assigneeId
    ? (db().prepare(`SELECT ${RECIPIENT_COLUMNS} FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ? WHERE m.id = ? AND om.role = 'presidency' AND m.status = 'active'`).get(user.org_id, user.org_id, assigneeId) as Recipient | undefined)
    : undefined;
  let previousAssignee: number | null = null;
  if (id) {
    const prev = db().prepare("SELECT assignee_id FROM todos WHERE id = ? AND org_id = ?").get(id, user.org_id) as { assignee_id: number | null } | undefined;
    if (!prev) go("That assignment no longer exists.");
    previousAssignee = prev.assignee_id;
    db().prepare("UPDATE todos SET title = ?, notes = ?, due_date = ?, assignee_id = ? WHERE id = ?").run(title, notes, due, assignee?.id ?? null, id);
  } else {
    db().prepare("INSERT INTO todos (org_id, title, notes, due_date, assignee_id, created_by) VALUES (?, ?, ?, ?, ?, ?)").run(user.org_id, title, notes, due, assignee?.id ?? null, user.id);
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
  db().prepare("UPDATE todos SET done = ?, done_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ? AND org_id = ?").run(done, done, Number(fd.get("item_id")), user.org_id);
  revalidatePath("/admin/todos");
  redirect("/admin/todos");
}

export async function deleteTodo(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("DELETE FROM todos WHERE id = ? AND org_id = ?").run(Number(fd.get("item_id")), user.org_id);
  revalidatePath("/admin/todos");
  go("Assignment deleted.");
}
