"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requirePresidency } from "@/lib/auth";
import { isPresidency } from "@/lib/permissions";
import { normalizeEmailAddress, normalizePhone } from "@/lib/contact";
import { deleteAccount, isLastPresidency } from "@/lib/accounts";
import { appUrl } from "@/lib/config";
import { sendAccountNotice } from "@/lib/login-code";
import type { Member, Role } from "@/lib/types";

const ROLES: Role[] = ["member", "admin", "presidency"];

function go(path: string, text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`);
}

export async function updateMember(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("item_id"));
  const m = db().prepare("SELECT * FROM members WHERE id = ? AND ward_id = ?").get(id, user.ward_id) as Member | undefined;
  if (!m) redirect("/admin/members");
  const name = String(fd.get("name") || "").trim().slice(0, 100);
  const rawEmail = String(fd.get("email") || "").trim();
  const rawPhone = String(fd.get("phone") || "").trim();
  const email = rawEmail ? normalizeEmailAddress(rawEmail) : null;
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!name) go(`/admin/members/${id}`, "Name is required.");
  if ((rawEmail && !email) || (rawPhone && !phone)) go(`/admin/members/${id}`, "That phone number or email doesn't look right.");
  if (!email && !phone) go(`/admin/members/${id}`, "Each member needs a phone number or an email to sign in.");
  if (phone && db().prepare("SELECT 1 FROM members WHERE ward_id = ? AND phone = ? AND id != ?").get(user.ward_id, phone, id)) {
    go(`/admin/members/${id}`, "Another member already uses that phone number.");
  }
  // Keep their contact choice valid for what they still have.
  let pref = m.contact_pref;
  if ((pref === "text" || pref === "both") && !phone) pref = email ? "email" : "none";
  if ((pref === "email" || pref === "both") && !email) pref = phone ? "text" : "none";

  let role = m.role;
  let status = m.status;
  if (isPresidency(user)) {
    const r = fd.get("role") as Role;
    if (ROLES.includes(r)) role = r;
    const s = String(fd.get("status") || m.status);
    if (s === "active" || s === "inactive") status = s;
    if ((role !== "presidency" || status !== "active") && isLastPresidency(user.ward_id, id)) {
      go(`/admin/members/${id}`, "At least one active presidency member is required.");
    }
  }
  db()
    .prepare("UPDATE members SET name = ?, display_name = ?, email = ?, phone = ?, contact_pref = ?, role = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, name, email, phone, pref, role, status, id);
  if (status !== "active") db().prepare("DELETE FROM sessions WHERE member_id = ?").run(id);
  revalidatePath("/admin/members");
  go(`/admin/members/${id}`, "Saved.");
}

export async function removeMember(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("item_id"));
  const m = db().prepare("SELECT display_name FROM members WHERE id = ? AND ward_id = ?").get(id, user.ward_id) as { display_name: string } | undefined;
  if (!m) redirect("/admin/members");
  if (isLastPresidency(user.ward_id, id)) go(`/admin/members/${id}`, "At least one active presidency member is required.");
  deleteAccount(id);
  revalidatePath("/admin/members");
  go("/admin/members", `${m.display_name}'s account and everything they posted were deleted.`);
}

export async function decideAccess(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("item_id"));
  const approve = fd.get("decision") === "approve";
  const m = db().prepare("SELECT * FROM members WHERE id = ? AND ward_id = ? AND status = 'pending'").get(id, user.ward_id) as Member | undefined;
  if (!m) redirect("/admin/access");
  if (!approve) {
    // Declined requests aren't kept.
    deleteAccount(id);
    revalidatePath("/admin/access");
    go("/admin/access", `${m.display_name}'s request was declined and removed.`);
  }
  db().prepare("UPDATE members SET status = 'active', request_note = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
  await sendAccountNotice(m, `You're approved: ${user.ward.name}`, `Hi ${m.display_name},\n\nYour request was approved. You can now sign in to ${user.ward.name}.`, { url: `${appUrl()}/login`, label: "Sign in" });
  revalidatePath("/admin/access");
  go("/admin/access", `${m.display_name} was approved and emailed.`);
}
