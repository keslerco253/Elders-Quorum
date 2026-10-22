"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTodo, isPresidencyOf, setTodoStatus, STATUS_LABELS, type TodoStatus } from "@/lib/assignments";
import { audienceMembers, notify, recipientById, type Recipient } from "@/lib/notify";
import { withOrg } from "@/lib/org-cookie";
import { todayIn } from "@/lib/time";
import { answerHandoff, askToTake, cancelHandoff, getHandoff, unableToDo } from "@/lib/assignment-handoffs";

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

const back = (t: { id: number; org_id: number }, text: string, error = false) => {
  const page = withOrg(`/assignments/${t.id}`, t.org_id);
  redirect(`${page}${page.includes("?") ? "&" : "?"}${error ? "error" : "msg"}=${encodeURIComponent(text)}`);
};

/** The presidency, plus anyone else given, less whoever is doing this. */
function presidencyAnd(orgId: number, others: (number | null | undefined)[], except: number): Recipient[] {
  const to = new Map<number, Recipient>();
  for (const r of audienceMembers(orgId, "presidency")) to.set(r.id, r);
  for (const id of others) {
    const r = recipientById(id, orgId);
    if (r) to.set(r.id, r);
  }
  to.delete(except);
  return [...to.values()];
}

/** A presidency member asks someone, or the whole presidency, to take an assignment. */
export async function askToTakeAssignment(fd: FormData) {
  const user = await requireUser();
  const t = getTodo(Number(fd.get("item_id")));
  if (!t) redirect("/assignments");
  const who = String(fd.get("to") || "");
  const toId = who === "presidency" ? null : Number(who) || -1;
  const note = String(fd.get("note") || "");
  const r = askToTake(t.id, user.id, toId, note);
  if ("error" in r) back(t, r.error, true);
  const recipients = toId === null ? audienceMembers(t.org_id, "presidency").filter((p) => p.id !== user.id && p.id !== t.assignee_id) : [recipientById(toId, t.org_id)].filter((x): x is Recipient => !!x);
  await notify(recipients, {
    title: "Can you take this assignment?",
    body: `${user.display_name} asked${toId === null ? " the presidency" : ""}: ${t.title}${note.trim() ? ` (“${note.trim().slice(0, 200)}”)` : ""}`.slice(0, 300),
    url: withOrg(`/assignments/${t.id}`, t.org_id),
  });
  revalidatePath("/", "layout");
  back(t, toId === null ? "Asked the presidency. Whoever says yes first takes it." : "Asked. You'll be notified when they answer.");
}

/** Yes (it's now theirs) or no to being asked to take an assignment. */
export async function answerAssignmentAsk(fd: FormData) {
  const user = await requireUser();
  const accept = fd.get("answer") === "yes";
  const r = answerHandoff(Number(fd.get("handoff_id")), user.id, accept);
  if (!r) redirect("/assignments?msg=" + encodeURIComponent("That request was already answered or withdrawn."));
  const { handoff: h, todo: t } = r;
  const url = withOrg(`/assignments/${t.id}`, t.org_id);
  if (accept) {
    // Everyone in the presidency, whoever asked and whoever had it, knows who has it now.
    await notify(presidencyAnd(t.org_id, [h.from_id, r.previousAssignee], user.id), { title: `${user.display_name} took an assignment`, body: t.title, url });
  } else if (r.allDeclined && h.from_id) {
    const from = recipientById(h.from_id, t.org_id);
    if (from) await notify([from], { title: h.to_id ? `${user.display_name} can't take an assignment` : "No one in the presidency could take an assignment", body: t.title, url });
  }
  revalidatePath("/", "layout");
  if (accept) back(t, "It's yours now. Thank you!");
  redirect(isPresidencyOf(user.id, t.org_id) ? `${url}${url.includes("?") ? "&" : "?"}msg=${encodeURIComponent("Thanks for letting us know.")}` : "/assignments?msg=" + encodeURIComponent("Thanks for letting us know."));
}

/** Withdraws an unanswered ask (whoever asked). */
export async function withdrawAssignmentAsk(fd: FormData) {
  const user = await requireUser();
  const h = getHandoff(Number(fd.get("handoff_id")));
  const t = h && getTodo(h.todo_id);
  if (!h || !t) redirect("/assignments");
  cancelHandoff(h.id, user.id);
  revalidatePath("/", "layout");
  back(t, "Request withdrawn.");
}

/** The person assigned can't do it: it goes back to the presidency, who are told (with their note). */
export async function unableToDoAssignment(fd: FormData) {
  const user = await requireUser();
  const note = String(fd.get("note") || "");
  const t = unableToDo(Number(fd.get("item_id")), user.id, note);
  if (!t) redirect("/assignments");
  await notify(presidencyAnd(t.org_id, [t.created_by], user.id), {
    title: `${user.display_name} is unable to do an assignment`,
    body: `${t.title}${note.trim() ? `: “${note.trim().slice(0, 200)}”` : ""}`.slice(0, 300),
    url: withOrg(`/assignments/${t.id}`, t.org_id),
  });
  revalidatePath("/", "layout");
  if (isPresidencyOf(user.id, t.org_id)) back(t, "Done. It's unassigned now, and the presidency knows.");
  redirect("/assignments?msg=" + encodeURIComponent("Thanks for letting us know. Your presidency has been told."));
}
