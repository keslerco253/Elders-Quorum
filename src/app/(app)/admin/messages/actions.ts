"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { type Audience } from "@/lib/notify";
import { canManage, canSendTo, getGroup, sendToAudience } from "@/lib/groups";
import type { CurrentUser, Role } from "@/lib/types";
import { orgRoster } from "@/lib/orgs";

function go(path: string, text: string): never {
  redirect(`${path}?msg=${encodeURIComponent(text)}`);
}
const LINKS = ["/", "/lessons", "/calendar", "/plans", "/signups"];

function parseAudience(v: string, user: CurrentUser): Audience | null {
  if (["everyone", "admins", "presidency", "teachers"].includes(v)) return v as Audience;
  const m = v.match(/^group:(\d+)$/);
  const g = m ? getGroup(Number(m[1]), user.org_id) : undefined;
  if (g && canSendTo(g, user.id, user.role)) return v as Audience;
  return null;
}

export async function sendMessage(fd: FormData) {
  const user = await requireAdmin();
  const audience = parseAudience(String(fd.get("audience") || ""), user);
  const title = String(fd.get("title") || "").trim().slice(0, 120);
  const body = String(fd.get("body") || "").trim().slice(0, 2000);
  const link = LINKS.includes(String(fd.get("link"))) ? String(fd.get("link")) : "/";
  if (!audience || !title || !body) go("/admin/messages", "Please choose who to send to and fill in the title and message.");
  const { count, push, email, text, reached } = await sendToAudience({ orgId: user.org_id, senderId: user.id, audience, title, body, link, tz: user.ward.timezone });
  revalidatePath("/admin/messages");
  const missed = count - reached;
  go(
    "/admin/messages",
    `Sent to ${count}: ${push} by notification, ${email} by email, ${text} by text${missed > 0 ? `. ${missed} couldn't be reached (notifications off and no texts or emails chosen)` : ""}.`,
  );
}

/** Who can send to a group, from the form's checkboxes. */
function senders(fd: FormData) {
  return {
    presidency: fd.get("send_presidency") === "on" ? 1 : 0,
    admins: 0,
    members: fd.get("send_members") === "on" ? 1 : 0,
  };
}

export async function createGroup(fd: FormData) {
  const user = await requireAdmin();
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  // Any organization in the ward the person leads (admin or presidency there).
  const orgId = Number(fd.get("org_id")) || user.org_id;
  const org = user.orgs.find((o) => o.id === orgId && (o.role === "presidency"));
  if (!name || !org) go("/admin/groups", "Give the group a name.");
  const s = senders(fd);
  const r = db()
    .prepare("INSERT INTO groups (org_id, name, send_presidency, send_admins, send_members) VALUES (?, ?, ?, ?, ?)")
    .run(org.id, name, s.presidency, s.admins, s.members);
  redirect(`/admin/groups/${r.lastInsertRowid}${org.id !== user.org_id ? `?org=${org.id}` : ""}`);
}

export async function saveGroup(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("item_id"));
  const g = getGroup(id, user.org_id);
  if (!g || !canManage(g, user.role)) redirect("/admin/groups");
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  const ids = fd.getAll("member_id").map(Number).filter(Boolean);
  const valid = new Set(orgRoster(user.org_id).map((r) => r.id));
  const s = senders(fd);
  db().transaction(() => {
    if (name) db().prepare("UPDATE groups SET name = ? WHERE id = ?").run(name, id);
    db().prepare("UPDATE groups SET send_presidency = ?, send_admins = ?, send_members = ? WHERE id = ?").run(s.presidency, s.admins, s.members, id);
    db().prepare("DELETE FROM group_members WHERE group_id = ?").run(id);
    const ins = db().prepare("INSERT INTO group_members (group_id, member_id) VALUES (?, ?)");
    for (const m of ids) if (valid.has(m)) ins.run(id, m);
  })();
  revalidatePath("/admin/groups");
  go(`/admin/groups/${id}`, "Group saved.");
}

export async function deleteGroup(fd: FormData) {
  const user = await requireAdmin();
  const g = getGroup(Number(fd.get("item_id")), user.org_id);
  if (g && canManage(g, user.role)) db().prepare("DELETE FROM groups WHERE id = ?").run(g.id);
  revalidatePath("/admin/groups");
  go("/admin/groups", "Group deleted.");
}
