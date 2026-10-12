"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";

const TYPES = ["home", "church", "phone", "text"];

function go(path: string, text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`);
}

export async function saveVisit(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("id")) || null;
  const memberId = Number(fd.get("member_id"));
  const date = String(fd.get("date") || "");
  const type = String(fd.get("type") || "");
  const notes = String(fd.get("notes") || "").trim().slice(0, 2000);
  const followUp = fd.get("follow_up") === "on" ? 1 : 0;
  const followUpDone = fd.get("follow_up_done") === "on" ? 1 : 0;
  const back = id ? `/admin/visits/${id}` : `/admin/visits/new?member=${memberId || ""}`;
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
  revalidatePath("/admin/visits", "layout");
  go(`/admin/visits?member=${memberId}`, "Visit saved.");
}

export async function deleteVisit(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("DELETE FROM visits WHERE id = ? AND ward_id = ?").run(Number(fd.get("id")), user.ward_id);
  revalidatePath("/admin/visits", "layout");
  go("/admin/visits", "Visit deleted.");
}

export async function markFollowUpDone(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("UPDATE visits SET follow_up_done = 1 WHERE id = ? AND ward_id = ?").run(Number(fd.get("id")), user.ward_id);
  revalidatePath("/admin/visits", "layout");
  go("/admin/visits?view=followups", "Follow-up marked done.");
}
