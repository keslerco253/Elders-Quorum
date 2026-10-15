"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requirePresidency, requireUser } from "@/lib/auth";
import { isPresidency } from "@/lib/permissions";
import { normalizeEmailAddress, normalizePhone, parseContact } from "@/lib/contact";
import { findMemberByContact } from "@/lib/auth-core";
import { sendInviteEmail } from "@/lib/invite";
import { isLastPresidency, onlyLeaderOf, removeFromOrg, removeFromWard } from "@/lib/accounts";
import { addToOrg, managedOrgs, orgMemberView, wardMember } from "@/lib/orgs";
import { appUrl } from "@/lib/config";
import { sendAccountNotice } from "@/lib/login-code";
import { CALLINGS, isCalling, roleLabel, type Role } from "@/lib/types";

const ROLES: Role[] = ["member", "admin", "presidency"];

function go(path: string, text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`);
}

export async function updateMember(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("item_id"));
  const m = orgMemberView(user.org_id, id);
  if (!m) redirect("/admin/members");
  const name = String(fd.get("name") || "").trim().slice(0, 100);
  const rawEmail = String(fd.get("email") || "").trim();
  const rawPhone = String(fd.get("phone") || "").trim();
  const email = rawEmail ? normalizeEmailAddress(rawEmail) : null;
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!name) go(`/admin/members/${id}`, "Name is required.");
  if ((rawEmail && !email) || (rawPhone && !phone)) go(`/admin/members/${id}`, "That phone number or email doesn't look right.");
  if (!email && !phone) go(`/admin/members/${id}`, "Each member needs a phone number or an email to sign in.");
  if (phone && db().prepare("SELECT 1 FROM members WHERE phone = ? AND id != ?").get(phone, id)) {
    go(`/admin/members/${id}`, "Another account already uses that phone number.");
  }
  if (email && db().prepare("SELECT 1 FROM members WHERE lower(email) = ? AND id != ? AND status = 'active'").get(email, id)) {
    go(`/admin/members/${id}`, "Another account already uses that email.");
  }
  // Keep their contact choice valid for what they still have.
  let pref = m.contact_pref;
  if ((pref === "text" || pref === "both") && !phone) pref = email ? "email" : "none";
  if ((pref === "email" || pref === "both") && !email) pref = phone ? "text" : "none";

  // Turning an account off applies everywhere, so only ward leaders can.
  let status = m.status;
  if (user.wardLeader) {
    const s = String(fd.get("status") || m.status);
    if (s === "active" || s === "inactive") status = s;
    if (status !== "active" && onlyLeaderOf(id, user.ward_id).length) go(`/admin/members/${id}`, "They're the only presidency member of an organization. Give it another leader first.");
  }
  db()
    .prepare("UPDATE members SET name = ?, display_name = ?, email = ?, phone = ?, contact_pref = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, name, email, phone, pref, status, id);
  // A new number hasn't agreed to texts; the member can agree under More → Contact & notifications.
  if (phone !== m.phone) db().prepare("UPDATE members SET sms_consent_at = NULL WHERE id = ?").run(id);
  if (status !== "active") db().prepare("DELETE FROM sessions WHERE member_id = ?").run(id);
  if (isPresidency(user)) {
    // Role and calling are for this organization only; one president (or bishop) at a time.
    const r = fd.get("role") as Role;
    const role = ROLES.includes(r) ? r : m.role;
    if (role !== "presidency" && isLastPresidency(user.org_id, id)) go(`/admin/members/${id}`, `At least one ${roleLabel("presidency", user.org).toLowerCase()} member is required.`);
    const raw = String(fd.get("calling") || "");
    const calling = role !== "member" && isCalling(raw) && CALLINGS[user.org.kind].includes(raw) ? raw : null;
    if (calling === "president" || calling === "bishop") db().prepare("UPDATE org_members SET calling = NULL WHERE org_id = ? AND calling = ? AND member_id != ?").run(user.org_id, calling, id);
    if (role !== "member" || m.in_org) addToOrg(id, user.org_id, { role, calling });
  }
  revalidatePath("/admin/members");
  go(`/admin/members/${id}`, "Saved.");
}

/** Out of this organization, or (from the ward-wide organization) out of the ward. */
export async function removeMember(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("item_id"));
  const m = orgMemberView(user.org_id, id);
  if (!m) redirect("/admin/members");
  if (user.org.kind === "ward") {
    if (onlyLeaderOf(id, user.ward_id).length) go(`/admin/members/${id}`, "They're the only presidency member of an organization in this ward. Give it another leader first.");
    const deleted = removeFromWard(id, user.ward_id);
    revalidatePath("/admin/members");
    go("/admin/members", deleted ? `${m.display_name} was removed, and their account was deleted.` : `${m.display_name} was removed from ${user.ward.name}.`);
  }
  if (isLastPresidency(user.org_id, id)) go(`/admin/members/${id}`, "At least one active presidency member is required.");
  removeFromOrg(id, user.org_id);
  revalidatePath("/admin/members");
  go("/admin/members", `${m.display_name} was removed from ${user.orgLabel}.`);
}

/** Legacy join requests (before join codes were required). */
export async function decideAccess(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("item_id"));
  const approve = fd.get("decision") === "approve";
  const m = wardMember(id, user.org_id);
  if (!m || m.status !== "pending") redirect("/admin/access");
  if (!approve) {
    // Declined requests aren't kept.
    removeFromWard(id, user.ward_id);
    revalidatePath("/admin/access");
    go("/admin/access", `${m.display_name}'s request was declined and removed.`);
  }
  db().prepare("UPDATE members SET status = 'active', request_note = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
  await sendAccountNotice(m, `You're approved: ${user.ward.name}`, `Hi ${m.display_name},\n\nYour request was approved. You can now sign in to ${user.ward.name}.`, { url: `${appUrl()}/login`, label: "Sign in" });
  revalidatePath("/admin/access");
  go("/admin/access", `${m.display_name} was approved and emailed.`);
}

/**
 * Leaders add someone to this organization (and the ward) by name and phone or
 * email. Someone who already has an account is just added. New people agree to
 * terms and texts at first sign-in.
 */
export async function addMember(fd: FormData) {
  const user = await requirePresidency();
  const name = String(fd.get("name") || "").trim().slice(0, 100);
  const raw = String(fd.get("contact") || "");
  const c = parseContact(raw);
  const back = (msg: string): never => redirect(`/admin/members?add=1&name=${encodeURIComponent(name)}&contact=${encodeURIComponent(raw)}&msg=${encodeURIComponent(msg)}#add`);
  if (!name) back("Enter their name.");
  if (!c) return back("Enter a mobile number like (208) 555-0142 or an email address.");
  const role = ROLES.includes(fd.get("role") as Role) ? (fd.get("role") as Role) : "member";
  const existing = findMemberByContact(c.value);
  if (existing) {
    if (existing.status !== "active") redirect(`/admin/members?msg=${encodeURIComponent(`${existing.display_name}'s account is turned off or waiting for approval.`)}`);
    addToOrg(existing.id, user.org_id, { role });
    revalidatePath("/admin/members");
    redirect(`/admin/members/${existing.id}?msg=${encodeURIComponent(`${existing.display_name} already had an account, and is now in ${user.orgLabel}.`)}`);
  }
  const id = Number(
    db()
      .prepare(`INSERT INTO members (name, display_name, ${c.kind}, contact_pref, status, source) VALUES (?, ?, ?, ?, 'active', 'manual')`)
      .run(name, name, c.value, c.kind === "email" ? "email" : "none").lastInsertRowid,
  );
  addToOrg(id, user.org_id, { role });
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
  const m = wardMember(id, user.org_id);
  if (!m?.email) redirect("/admin/members");
  const ok = await sendInviteEmail(m, user.ward.name, user.display_name);
  go(`/admin/members/${id}`, ok ? `Invite emailed to ${m.email}.` : "The invite email didn't send. Check email in Settings.");
}

/**
 * Which organizations a member officially belongs to. The bishopric can set
 * any organization in the ward; a presidency only its own. Leaders of an
 * organization keep their place there. Unticking takes them out (they can
 * still choose it again themselves).
 */
export async function setMemberOrgs(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("item_id"));
  const back = `/admin/members/${id}`;
  if (!wardMember(id, user.org_id)) redirect("/admin/members");
  const d = db();
  const changeable = managedOrgs(user);
  d.transaction(() => {
    for (const o of changeable) {
      const want = fd.get(`org_${o.id}`) === "on";
      const row = d.prepare("SELECT role, official FROM org_members WHERE org_id = ? AND member_id = ?").get(o.id, id) as { role: Role; official: number } | undefined;
      if (row && row.role !== "member") continue;
      if (want && !row) addToOrg(id, o.id);
      else if (want && row && !row.official) d.prepare("UPDATE org_members SET official = 1, notify = 1 WHERE org_id = ? AND member_id = ?").run(o.id, id);
      else if (!want && row?.official) removeFromOrg(id, o.id);
    }
  })();
  revalidatePath("/", "layout");
  go(back, "Organizations saved.");
}
