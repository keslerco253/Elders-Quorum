"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requirePresidency } from "@/lib/auth";
import { isPresidency } from "@/lib/permissions";
import { normalizeEmail } from "@/lib/auth-core";
import type { Mapping } from "@/lib/lcr-import";
import { deleteUpload, loadImport, saveUpload } from "@/lib/import-store";
import { appUrl } from "@/lib/config";
import { emailHtml, sendMail } from "@/lib/mail";
import type { Member, Role } from "@/lib/types";

const ROLES: Role[] = ["member", "admin", "presidency"];
const msg = (base: string, text: string) => `${base}${base.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`;

function readContact(fd: FormData) {
  const name = String(fd.get("name") || "").trim();
  const display = String(fd.get("display_name") || "").trim() || name;
  const email = normalizeEmail(String(fd.get("email") || "")) || null;
  return {
    name,
    display,
    email: email && email.includes("@") ? email : null,
    phone: String(fd.get("phone") || "").trim() || null,
    address: String(fd.get("address") || "").trim() || null,
  };
}

export async function createMember(fd: FormData) {
  const user = await requireAdmin();
  const c = readContact(fd);
  if (!c.name) redirect(msg("/admin/members/new", "Name is required."));
  const role = isPresidency(user) && ROLES.includes(fd.get("role") as Role) ? (fd.get("role") as Role) : "member";
  const r = db()
    .prepare("INSERT INTO members (ward_id, name, display_name, email, phone, address, role, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')")
    .run(user.ward_id, c.name, c.display, c.email, c.phone, c.address, role);
  revalidatePath("/admin/members");
  redirect(msg(`/admin/members/${r.lastInsertRowid}`, "Member added."));
}

export async function updateMember(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("id"));
  const m = db().prepare("SELECT * FROM members WHERE id = ? AND ward_id = ?").get(id, user.ward_id) as Member | undefined;
  if (!m) redirect("/admin/members");
  const c = readContact(fd);
  if (!c.name) redirect(msg(`/admin/members/${id}`, "Name is required."));

  let role = m.role;
  let status = m.status;
  if (isPresidency(user)) {
    const r = fd.get("role") as Role;
    if (ROLES.includes(r)) role = r;
    const s = String(fd.get("status") || m.status);
    if (s === "active" || s === "inactive") status = s;
    // Never let the last presidency member lock everyone out.
    if (m.role === "presidency" && (role !== "presidency" || status !== "active")) {
      const others = db().prepare("SELECT COUNT(*) AS n FROM members WHERE ward_id = ? AND role = 'presidency' AND status = 'active' AND id != ?").get(user.ward_id, id) as { n: number };
      if (others.n === 0) redirect(msg(`/admin/members/${id}`, "At least one active presidency member is required."));
    }
  }
  db()
    .prepare("UPDATE members SET name = ?, display_name = ?, email = ?, phone = ?, address = ?, role = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(c.name, c.display, c.email, c.phone, c.address, role, status, id);
  if (status !== "active") db().prepare("DELETE FROM sessions WHERE member_id = ?").run(id);
  revalidatePath("/admin/members");
  redirect(msg(`/admin/members/${id}`, "Saved."));
}

export async function decideAccess(fd: FormData) {
  const user = await requirePresidency();
  const id = Number(fd.get("id"));
  const approve = fd.get("decision") === "approve";
  const m = db().prepare("SELECT * FROM members WHERE id = ? AND ward_id = ? AND status = 'pending'").get(id, user.ward_id) as Member | undefined;
  if (!m) redirect("/admin/access");
  db().prepare("UPDATE members SET status = ?, updated_at = datetime('now') WHERE id = ?").run(approve ? "active" : "declined", id);
  if (approve && m.email) {
    const text = `Hi ${m.display_name},\n\nYour request was approved. You can now sign in to ${user.ward.name} with this email address.`;
    await sendMail({ to: m.email, subject: `You're approved: ${user.ward.name}`, text: `${text}\n\n${appUrl()}/login`, html: emailHtml("Welcome!", text, { url: `${appUrl()}/login`, label: "Sign in" }) });
  }
  revalidatePath("/admin/access");
  redirect(msg("/admin/access", approve ? `${m.display_name} was approved and emailed.` : `${m.display_name}'s request was declined.`));
}

// ---- LCR import -----------------------------------------------------------

export async function uploadImport(fd: FormData) {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(msg("/admin/members/import", "Please choose the CSV file exported from LCR."));
  if (file.size > 5_000_000) redirect(msg("/admin/members/import", "That file is too large."));
  const id = saveUpload(Buffer.from(await file.arrayBuffer()));
  redirect(`/admin/members/import?file=${id}`);
}

export async function applyImport(fd: FormData) {
  const user = await requireAdmin();
  const fileId = String(fd.get("file") || "");
  const mapping: Mapping = { name: String(fd.get("map_name") || ""), address: String(fd.get("map_address") || ""), phone: String(fd.get("map_phone") || ""), email: String(fd.get("map_email") || "") };
  if (!mapping.name) redirect(msg(`/admin/members/import?file=${fileId}`, "Choose which column holds the name."));
  const loaded = loadImport(user.ward_id, fileId, mapping);
  if (!loaded) redirect(msg("/admin/members/import", "That upload expired. Please upload the file again."));
  const { plan } = loaded;
  const deactivate = fd.get("deactivate_missing") === "on";
  const d = db();
  d.transaction(() => {
    const ins = d.prepare("INSERT INTO members (ward_id, name, display_name, email, phone, address, source) VALUES (?, ?, ?, ?, ?, ?, 'import')");
    for (const r of plan.creates) ins.run(user.ward_id, r.name, r.displayName, r.email, r.phone, r.address);
    const upd = d.prepare(
      `UPDATE members SET email = coalesce(?, email), phone = coalesce(?, phone), address = coalesce(?, address),
       status = 'active', updated_at = datetime('now') WHERE id = ?`,
    );
    for (const u of plan.updates) upd.run(u.row.email, u.row.phone, u.row.address, u.id);
    if (deactivate) {
      const off = d.prepare("UPDATE members SET status = 'inactive', updated_at = datetime('now') WHERE id = ?");
      for (const m of plan.missing) off.run(m.id);
    }
  })();
  deleteUpload(fileId);
  revalidatePath("/admin/members");
  const parts = [`${plan.creates.length} added`, `${plan.updates.length} updated`, `${plan.unchanged} unchanged`];
  if (deactivate && plan.missing.length) parts.push(`${plan.missing.length} marked moved out`);
  redirect(msg("/admin/members", `Import complete: ${parts.join(", ")}.`));
}
