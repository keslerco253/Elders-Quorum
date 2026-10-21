"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTodo, isPresidencyOf, setTodoStatus, STATUS_LABELS, type TodoStatus } from "@/lib/assignments";
import { audienceMembers, notify, recipientById, type Recipient } from "@/lib/notify";
import { withOrg } from "@/lib/org-cookie";
import { todayIn } from "@/lib/time";

/**
 * A progress note on an assignment, and/or a new status, from the person assigned or
 * anyone in the presidency. Notes marked presidency only are kept from the person.
 * The person hears about the presidency's notes; the presidency hears about the
 * person's progress (and anyone finishing it).
 */
export async function addProgress(fd: FormData) {
  const user = await requireUser();
  const t = getTodo(Number(fd.get("item_id")));
  const leader = !!t && isPresidencyOf(user.id, t.org_id);
  if (!t || (!leader && t.assignee_id !== user.id)) redirect("/assignments");
  const page = withOrg(`/assignments/${t.id}`, t.org_id);
  const body = String(fd.get("body") || "").trim().slice(0, 2000);
  const priv = leader && fd.get("private") === "on" && t.assignee_id !== user.id ? 1 : 0;
  const status = String(fd.get("status") || "") as TodoStatus;
  const newStatus = ["open", "progress", "done"].includes(status) && status !== t.status ? status : null;
  if (!body && !newStatus) redirect(`${page}${page.includes("?") ? "&" : "?"}msg=${encodeURIComponent("Write a note first.")}`);

  if (body) db().prepare("INSERT INTO todo_notes (todo_id, author_id, body, private) VALUES (?, ?, ?, ?)").run(t.id, user.id, body, priv);
  if (newStatus) setTodoStatus(t.id, newStatus, todayIn(user.ward.timezone));

  const what = [newStatus && `Marked ${STATUS_LABELS[newStatus].toLowerCase()}`, body].filter(Boolean).join(": ");
  const payload = { title: newStatus === "done" ? `Done: ${t.title}` : `Update on: ${t.title}`, body: `${user.display_name}: ${what}`.slice(0, 300), url: page };
  const to = new Map<number, Recipient>();
  // The presidency hears about the person's progress, and whenever it's finished.
  if (!priv && (!leader || newStatus === "done")) for (const r of audienceMembers(t.org_id, "presidency")) to.set(r.id, r);
  // The person hears from the presidency (not about notes kept from them).
  if (leader && !priv && t.assignee_id) {
    const a = recipientById(t.assignee_id, t.org_id);
    if (a) to.set(a.id, a);
  }
  to.delete(user.id);
  if (to.size) await notify([...to.values()], payload);
  revalidatePath("/", "layout");
  redirect(`${page}${page.includes("?") ? "&" : "?"}msg=${encodeURIComponent(newStatus === "done" ? "Marked done. Thank you!" : "Saved.")}#end`);
}
