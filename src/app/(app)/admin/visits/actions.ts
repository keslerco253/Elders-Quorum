"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";
import { deletePlan, getPlannedVisit, inviteMessage, isDate, isTime, savePlan, sendInvitation, whenText } from "@/lib/planned-visits";
import { firstName } from "@/lib/names";
import { sendAnswer } from "@/lib/conversations";

const TYPES = ["home", "church", "phone", "text"];

function go(path: string, text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`);
}

export async function saveVisit(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("item_id")) || null;
  const memberId = Number(fd.get("member_id"));
  const date = String(fd.get("date") || "");
  const type = String(fd.get("type") || "");
  const notes = String(fd.get("notes") || "").trim().slice(0, 2000);
  const followUp = fd.get("follow_up") === "on" ? 1 : 0;
  const followUpDone = fd.get("follow_up_done") === "on" ? 1 : 0;
  const plan = Number(fd.get("plan_id")) ? getPlannedVisit(user.ward_id, Number(fd.get("plan_id"))) : undefined;
  const back = id ? `/admin/visits/${id}` : `/admin/visits/new?member=${memberId || ""}${Number(fd.get("plan_id")) ? `&plan=${Number(fd.get("plan_id"))}` : ""}`;
  const member = db().prepare("SELECT id FROM members WHERE id = ? AND ward_id = ?").get(memberId, user.ward_id);
  if (!member || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !TYPES.includes(type)) go(back, "Choose who was visited, the date and the type of visit.");
  // Allowed visitors: current presidency, plus anyone already on this visit (e.g. a released counselor).
  const presidency = new Set(
    (db()
      .prepare("SELECT id FROM members WHERE ward_id = ? AND (role = 'presidency' OR id IN (SELECT member_id FROM visit_visitors WHERE visit_id = ?))")
      .all(user.ward_id, id ?? 0) as { id: number }[]).map((r) => r.id),
  );
  const visitors = fd.getAll("visitor_id").map(Number).filter((v) => presidency.has(v));
  if (!visitors.length) go(back, "Choose who made the visit.");

  const d = db();
  const visitId = d.transaction(() => {
    let vid = id;
    if (vid) {
      const r = d.prepare("UPDATE visits SET member_id = ?, date = ?, type = ?, notes = ?, follow_up = ?, follow_up_done = ? WHERE id = ? AND ward_id = ?").run(memberId, date, type, notes, followUp, followUpDone, vid, user.ward_id);
      if (!r.changes) return null;
      d.prepare("DELETE FROM visit_visitors WHERE visit_id = ?").run(vid);
    } else {
      vid = Number(d.prepare("INSERT INTO visits (ward_id, member_id, date, type, notes, follow_up, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)").run(user.ward_id, memberId, date, type, notes, followUp, user.id).lastInsertRowid);
    }
    const ins = d.prepare("INSERT INTO visit_visitors (visit_id, member_id) VALUES (?, ?)");
    for (const v of visitors) ins.run(vid, v);
    return vid;
  })();
  if (!visitId) redirect("/admin/visits");
  // A planned visit that's now recorded leaves Upcoming; its request (if any) is done.
  if (plan) {
    deletePlan(user.ward_id, plan.id);
    if (plan.request_id) d.prepare("UPDATE visit_requests SET status = 'done', handled_by = ?, updated_at = datetime('now') WHERE id = ? AND status IN ('open','scheduled')").run(user.id, plan.request_id);
  }
  revalidatePath("/admin/visits", "layout");
  go(`/admin/visits?member=${memberId}`, "Visit saved.");
}

export async function deleteVisit(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("DELETE FROM visits WHERE id = ? AND ward_id = ?").run(Number(fd.get("item_id")), user.ward_id);
  revalidatePath("/admin/visits", "layout");
  go("/admin/visits", "Visit deleted.");
}

export async function markFollowUpDone(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("UPDATE visits SET follow_up_done = 1 WHERE id = ? AND ward_id = ?").run(Number(fd.get("item_id")), user.ward_id);
  revalidatePath("/admin/visits", "layout");
  go("/admin/visits?view=followups", "Follow-up marked done.");
}

/** Plans a visit (or changes a planned one): who, when, and who's going. */
export async function savePlannedVisit(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("item_id")) || null;
  const requestId = Number(fd.get("request_id")) || null;
  const memberId = Number(fd.get("member_id"));
  const date = String(fd.get("date") || "");
  const time = String(fd.get("time") || "").trim() || null;
  const type = String(fd.get("type") || "home");
  const note = String(fd.get("note") || "").trim().slice(0, 1000);
  const back = `/admin/visits/plan?${id ? `id=${id}` : requestId ? `request=${requestId}` : `member=${memberId || ""}`}`;
  const d = db();
  const member = d.prepare("SELECT id, display_name FROM members WHERE id = ? AND ward_id = ?").get(memberId, user.ward_id) as { id: number; display_name: string } | undefined;
  if (!member || !isDate(date) || !TYPES.includes(type) || (time && !isTime(time))) go(back, "Choose who to visit, the date and the kind of visit.");
  const presidency = new Set((d.prepare("SELECT id FROM members WHERE ward_id = ? AND role = 'presidency'").all(user.ward_id) as { id: number }[]).map((r) => r.id));
  const visitors = fd.getAll("visitor_id").map(Number).filter((v) => presidency.has(v));
  if (!visitors.length) go(back, "Choose who's going.");
  const request = requestId ? (d.prepare("SELECT id, member_id FROM visit_requests WHERE id = ? AND ward_id = ?").get(requestId, user.ward_id) as { id: number; member_id: number } | undefined) : undefined;

  const planId = savePlan({ id, wardId: user.ward_id, memberId, date, time, type, note, requestId: request?.id ?? null, visitors, createdBy: user.id });

  const names = (d.prepare(`SELECT display_name FROM members WHERE id IN (${visitors.map(() => "?").join(",")}) ORDER BY display_name`).all(...visitors) as { display_name: string }[]).map((r) => r.display_name);
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const when = whenText(date, time);
  const message = type === "phone" ? `${who} will call you ${when}.` : type === "church" ? `${who} would like to meet with you at church ${when}.` : `${who} ${names.length > 1 ? "plan" : "plans"} to visit you ${when}.`;
  const mode = String(fd.get("notify_mode") || (fd.get("tell_member") === "on" ? "datetime" : "none"));
  const invitation = mode === "invite" ? String(fd.get("invite_message") || "").trim() || inviteMessage(firstName(member.display_name), date, time, names) : "";
  if (request) {
    d.prepare("UPDATE visit_requests SET status = 'scheduled', reply = ?, handled_by = ?, updated_at = datetime('now') WHERE id = ?").run(invitation || message, user.id, request.id);
  }
  if (mode === "invite") await sendInvitation(getPlannedVisit(user.ward_id, planId)!, invitation, user.id);
  else if (mode === "datetime") await sendAnswer(user, memberId, message);
  revalidatePath("/admin", "layout");
  const sent = mode === "invite" ? " Your invitation was sent; you'll be told when they answer." : mode === "datetime" ? " They were sent the date and time." : "";
  go("/admin/visits", `${id ? "Planned visit updated" : "Visit planned"}: ${member.display_name}, ${when}.${sent}`);
}

/** Cancels a planned visit. Its request (if any) goes back to waiting. */
export async function cancelPlannedVisit(fd: FormData) {
  const user = await requirePresidency();
  const plan = getPlannedVisit(user.ward_id, Number(fd.get("item_id")));
  if (!plan) redirect("/admin/visits");
  deletePlan(user.ward_id, plan.id);
  if (plan.request_id) db().prepare("UPDATE visit_requests SET status = 'open', updated_at = datetime('now') WHERE id = ? AND status = 'scheduled'").run(plan.request_id);
  revalidatePath("/admin", "layout");
  go("/admin/visits", `Planned visit with ${plan.member_name} cancelled.${plan.request_id ? " Their request is back under Visit requests." : ""}`);
}


/**
 * The presidency records the member's answer to an invitation themselves (e.g.
 * they talked on the phone). "Yes" can set the agreed date and time and moves
 * the visit to Upcoming visits.
 */
export async function markInvitation(fd: FormData) {
  const user = await requirePresidency();
  const plan = getPlannedVisit(user.ward_id, Number(fd.get("item_id")));
  if (!plan) redirect("/admin/visits");
  const answer = String(fd.get("answer"));
  const note = String(fd.get("note") || "").trim().slice(0, 500);
  const d = db();
  if (answer === "accepted") {
    const date = String(fd.get("date") || plan.date);
    const time = String(fd.get("time") || "").trim() || null;
    if (!isDate(date) || (time && !isTime(time))) go("/admin/visits", "Choose the date and time you agreed on.");
    d.prepare("UPDATE planned_visits SET date = ?, time = ?, invite_status = 'accepted', member_reply = ?, responded_at = datetime('now') WHERE id = ?").run(
      date,
      time,
      note || `Arranged by ${user.display_name}`,
      plan.id,
    );
    if (fd.get("confirm") === "on") {
      const names = plan.visitors ? plan.visitors.split(", ") : [];
      await sendAnswer(user, plan.member_id, `Thank you! ${names.length ? `${names.join(" and ")} will` : "We'll"} see you ${whenText(date, time)}.`);
    }
    revalidatePath("/admin", "layout");
    go("/admin/visits", `${plan.member_name}'s visit is set for ${whenText(date, time)} and is now under Upcoming visits.`);
  }
  if (answer === "new_time" || answer === "declined") {
    d.prepare("UPDATE planned_visits SET invite_status = ?, member_reply = ?, responded_at = datetime('now') WHERE id = ?").run(answer, note, plan.id);
    revalidatePath("/admin", "layout");
    go("/admin/visits", answer === "new_time" ? "Noted. Pick a new time when you're ready and send an updated invitation." : "Noted that they'd rather not have a visit right now.");
  }
  redirect("/admin/visits");
}
