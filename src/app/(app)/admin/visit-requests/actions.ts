"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";
import { notify, recipientById } from "@/lib/notify";
import type { VisitRequest } from "@/lib/visit-requests";
import { deletePlan, planForRequest } from "@/lib/planned-visits";

function go(msg: string): never {
  redirect(`/admin/visit-requests?msg=${encodeURIComponent(msg)}`);
}

/** Updates a request in this ward that's still active. */
function update(id: number, orgId: number, status: string | null, reply: string | null, by: number) {
  const r = db().prepare("SELECT * FROM visit_requests WHERE id = ? AND org_id = ? AND status IN ('open','scheduled')").get(id, orgId) as VisitRequest | undefined;
  if (!r) go("That request was already handled or cancelled.");
  db()
    .prepare("UPDATE visit_requests SET status = coalesce(?, status), reply = coalesce(?, reply), handled_by = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, reply, by, id);
  revalidatePath("/admin", "layout");
  return r;
}

/** Sends the member a reply, e.g. when someone will come by. Marks the request scheduled. */
export async function replyToVisitRequest(fd: FormData) {
  const user = await requirePresidency();
  const reply = String(fd.get("reply") || "").trim().slice(0, 500);
  if (!reply) go("Write a short reply to send, such as when someone will come by.");
  // A reply alone doesn't change the status; scheduling a visit does (Schedule visit).
  const r = update(Number(fd.get("item_id")), user.org_id, null, reply, user.id);
  // Also shown in the member's conversation, so a reply by text has context.
  // Unread until they open Messages, so the red dot on More points them to it.
  db().prepare("INSERT INTO member_messages (org_id, member_id, direction, author_id, body) VALUES (?, ?, 'out', ?, ?)").run(user.org_id, r.member_id, user.id, `About your visit request: ${reply}`);
  const member = recipientById(r.member_id, user.org_id);
  if (member) await notify([member], { title: "Your visit request", body: `${user.display_name}: ${reply}`, url: "/more/visit" });
  go("Reply sent.");
}

/** Closes the request as visited and opens the form to record the visit. */
export async function markRequestVisited(fd: FormData) {
  const user = await requirePresidency();
  // A scheduled visit: record it from the plan (that also closes the request).
  const plan = planForRequest(user.org_id, Number(fd.get("item_id")));
  if (plan) redirect(`/admin/visits/new?plan=${plan.id}`);
  const r = update(Number(fd.get("item_id")), user.org_id, "done", null, user.id);
  redirect(`/admin/visits/new?member=${r.member_id}&msg=${encodeURIComponent("Request marked as visited. Record the visit below if you'd like to keep a note of it.")}`);
}

/** Closes the request without a visit (e.g. handled another way). */
export async function closeVisitRequest(fd: FormData) {
  const user = await requirePresidency();
  update(Number(fd.get("item_id")), user.org_id, "closed", null, user.id);
  const plan = planForRequest(user.org_id, Number(fd.get("item_id")));
  if (plan) deletePlan(user.org_id, plan.id);
  go(plan ? "Request closed and its planned visit removed." : "Request closed.");
}
