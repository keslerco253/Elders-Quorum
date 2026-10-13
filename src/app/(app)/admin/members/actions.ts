"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requirePresidency } from "@/lib/auth";
import { isPresidency } from "@/lib/permissions";
import { normalizeEmailAddress, normalizePhone, parseContact } from "@/lib/contact";
import { findMemberByContact } from "@/lib/auth-core";
import { sendInviteEmail } from "@/lib/invite";
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
  // A new number hasn't agreed to texts; the member can agree under More → My contact info.
  if (phone !== m.phone) db().prepare("UPDATE members SET sms_consent_at = NULL WHERE id = ?").run(id);
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

/** The presidency adds someone by name and phone or email. They agree to terms and texts at first sign-in. */
export async function addMember(fd: FormData) {
  const user = await requirePresidency();
  const name = String(fd.get("name") || "").trim().slice(0, 100);
  const raw = String(fd.get("contact") || "");
  const c = parseContact(raw);
  const back = (msg: string): never => redirect(`/admin/members?add=1&name=${encodeURIComponent(name)}&contact=${encodeURIComponent(raw)}&msg=${encodeURIComponent(msg)}#add`);
  if (!name) back("Enter their name.");
  if (!c) return back("Enter a mobile number like (208) 555-0142 or an email address.");
  const existing = findMemberByContact(c.value, user.ward_id);
  if (existing) redirect(`/admin/members/${existing.id}?msg=${encodeURIComponent(`${existing.display_name} already has an account with that ${c.kind === "phone" ? "number" : "email"}.`)}`);
  const role = ROLES.includes(fd.get("role") as Role) ? (fd.get("role") as Role) : "member";
  const id = Number(
    db()
      .prepare(`INSERT INTO members (ward_id, name, display_name, ${c.kind}, contact_pref, role, status, source) VALUES (?, ?, ?, ?, ?, ?, 'active', 'manual')`)
      .run(user.ward_id, name, name, c.value, c.kind === "email" ? "email" : "none", role).lastInsertRowid,
  );
  let note = `${name} was added.`;
  if (c.kind === "email" && fd.get("send_invite") === "on") {
    note = (await sendInviteEmail({ display_name: name, email: c.value, phone: null }, user.ward.name, user.display_name)) ? `${name} was added and invited by email.` : `${name} was added, but the invite email didn't send. Check email in Settings.`;
  }
  revalidatePath("/admin/members");
  redirect(`/admin/members/${id}?msg=${encodeURIComponent(note)}`);
}

export async function emailInvite(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("item_id"));
  const m = db().prepare("SELECT * FROM members WHERE id = ? AND ward_id = ?").get(id, user.ward_id) as Member | undefined;
  if (!m?.email) redirect("/admin/members");
  const ok = await sendInviteEmail(m, user.ward.name, user.display_name);
  go(`/admin/members/${id}`, ok ? `Invite emailed to ${m.email}.` : "The invite email didn't send. Check email in Settings.");
}
