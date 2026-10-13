"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";
import { notify, recipientById } from "@/lib/notify";
import type { VisitRequest } from "@/lib/visit-requests";

function go(msg: string): never {
  redirect(`/admin/visit-requests?msg=${encodeURIComponent(msg)}`);
}

/** Updates a request in this ward that's still active. */
function update(id: number, wardId: number, status: string, reply: string | null, by: number) {
  const r = db().prepare("SELECT * FROM visit_requests WHERE id = ? AND ward_id = ? AND status IN ('open','scheduled')").get(id, wardId) as VisitRequest | undefined;
  if (!r) go("That request was already handled or cancelled.");
  db()
    .prepare("UPDATE visit_requests SET status = ?, reply = coalesce(?, reply), handled_by = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, reply, by, id);
  revalidatePath("/admin", "layout");
  return r;
}

/** Sends the member a reply, e.g. when someone will come by. Marks the request scheduled. */
export async function replyToVisitRequest(fd: FormData) {
  const user = await requirePresidency();
  const reply = String(fd.get("reply") || "").trim().slice(0, 500);
  if (!reply) go("Write a short reply to send, such as when someone will come by.");
  const r = update(Number(fd.get("item_id")), user.ward_id, "scheduled", reply, user.id);
  // Also shown in the member's conversation, so a reply by text has context.
  db().prepare("INSERT INTO member_messages (ward_id, member_id, direction, author_id, body, read_at) VALUES (?, ?, 'out', ?, ?, datetime('now'))").run(user.ward_id, r.member_id, user.id, `About your visit request: ${reply}`);
  const member = recipientById(r.member_id);
  if (member) await notify([member], { title: "Your visit request", body: `${user.display_name}: ${reply}`, url: "/more/visit" });
  go("Reply sent.");
}

/** Closes the request as visited and opens the form to record the visit. */
export async function markRequestVisited(fd: FormData) {
  const user = await requirePresidency();
  const r = update(Number(fd.get("item_id")), user.ward_id, "done", null, user.id);
  redirect(`/admin/visits/new?member=${r.member_id}&msg=${encodeURIComponent("Request marked as visited. Record the visit below if you'd like to keep a note of it.")}`);
}

/** Closes the request without a visit (e.g. handled another way). */
export async function closeVisitRequest(fd: FormData) {
  const user = await requirePresidency();
  update(Number(fd.get("item_id")), user.ward_id, "closed", null, user.id);
  go("Request closed.");
}
