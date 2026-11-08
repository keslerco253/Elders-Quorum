"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deletePersonalTodo, remindersFromForm, savePersonalTodo, setPersonalTodoDone } from "@/lib/personal-todos";
import { repeatFromForm } from "@/lib/recurrence";
import { formatDate } from "@/lib/time";

function go(path: string, text: string): never {
  redirect(`${path}?msg=${encodeURIComponent(text)}`);
}

/** A member's own private to-do: new or changed. */
export async function savePersonal(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("item_id")) || null;
  const title = String(fd.get("title") || "").trim().slice(0, 200);
  if (!title) go(id ? `/assignments/mine/${id}` : "/assignments/mine/new", "Give your to-do a title.");
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("due_date"))) ? String(fd.get("due_date")) : null;
  const time = /^\d{2}:\d{2}$/.test(String(fd.get("due_time"))) ? String(fd.get("due_time")) : null;
  const reminders = remindersFromForm(fd);
  const saved = savePersonalTodo(user.id, id, {
    title,
    notes: String(fd.get("notes") || "").trim().slice(0, 2000),
    due_date: due,
    due_time: time,
    reminders,
    repeat: due ? repeatFromForm(fd, due) : null,
  });
  revalidatePath("/", "layout");
  go("/assignments", saved ? (id ? "To-do saved." : "To-do added. It's private: only you can see it.") : "That to-do no longer exists.");
}

export async function donePersonal(fd: FormData) {
  const user = await requireUser();
  const done = fd.get("done") === "1";
  const next = setPersonalTodoDone(user.id, Number(fd.get("item_id")), done);
  revalidatePath("/", "layout");
  go("/assignments", done ? (next ? `Marked done. The next one is due ${formatDate(next, "short")}.` : "Marked done. Nice work!") : "Moved back to your list.");
}

export async function deletePersonal(fd: FormData) {
  const user = await requireUser();
  deletePersonalTodo(user.id, Number(fd.get("item_id")));
  revalidatePath("/", "layout");
  go("/assignments", "To-do deleted.");
}
