"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audienceLabel, audienceMembers, notify, type Audience } from "@/lib/notify";

function go(path: string, text: string): never {
  redirect(`${path}?msg=${encodeURIComponent(text)}`);
}
const LINKS = ["/", "/lessons", "/calendar", "/plans", "/signups"];

function parseAudience(v: string, wardId: number): Audience | null {
  if (["everyone", "admins", "presidency", "teachers"].includes(v)) return v as Audience;
  const m = v.match(/^group:(\d+)$/);
  if (m && db().prepare("SELECT 1 FROM groups WHERE id = ? AND ward_id = ?").get(Number(m[1]), wardId)) return v as Audience;
  return null;
}

export async function sendMessage(fd: FormData) {
  const user = await requireAdmin();
  const audience = parseAudience(String(fd.get("audience") || ""), user.ward_id);
  const title = String(fd.get("title") || "").trim().slice(0, 120);
  const body = String(fd.get("body") || "").trim().slice(0, 2000);
  const link = LINKS.includes(String(fd.get("link"))) ? String(fd.get("link")) : "/";
  if (!audience || !title || !body) go("/admin/messages", "Please choose who to send to and fill in the title and message.");
  const recipients = audienceMembers(user.ward_id, audience, { tz: user.ward.timezone });
  // Saved first so members can find it under Messages and reply to it.
  const d = db();
  const messageId = d.transaction(() => {
    const id = Number(
      d
        .prepare("INSERT INTO messages (ward_id, sender_id, audience, audience_label, title, body, link) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(user.ward_id, user.id, audience, audienceLabel(user.ward_id, audience), title, body, link).lastInsertRowid,
    );
    const ins = d.prepare("INSERT OR IGNORE INTO message_recipients (message_id, member_id) VALUES (?, ?)");
    for (const r of recipients) ins.run(id, r.id);
    return id;
  })();
  const { push, email, text, reached } = await notify(recipients, { title, body, url: `/messages?re=${messageId}` });
  d.prepare("UPDATE messages SET push_count = ?, email_count = ?, text_count = ? WHERE id = ?").run(push, email, text, messageId);
  revalidatePath("/admin/messages");
  const missed = recipients.length - reached;
  go(
    "/admin/messages",
    `Sent to ${recipients.length}: ${push} by notification, ${email} by email, ${text} by text${missed > 0 ? `. ${missed} couldn't be reached (notifications off and no texts or emails chosen)` : ""}.`,
  );
}

export async function createGroup(fd: FormData) {
  const user = await requireAdmin();
  const name = String(fd.get("name") || "").trim();
  if (!name) go("/admin/groups", "Give the group a name.");
  const r = db().prepare("INSERT INTO groups (ward_id, name) VALUES (?, ?)").run(user.ward_id, name);
  redirect(`/admin/groups/${r.lastInsertRowid}`);
}

export async function saveGroup(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("item_id"));
  const g = db().prepare("SELECT id FROM groups WHERE id = ? AND ward_id = ?").get(id, user.ward_id);
  if (!g) redirect("/admin/groups");
  const name = String(fd.get("name") || "").trim();
  const ids = fd.getAll("member_id").map(Number).filter(Boolean);
  const valid = new Set((db().prepare("SELECT id FROM members WHERE ward_id = ? AND status = 'active'").all(user.ward_id) as { id: number }[]).map((r) => r.id));
  db().transaction(() => {
    if (name) db().prepare("UPDATE groups SET name = ? WHERE id = ?").run(name, id);
    db().prepare("DELETE FROM group_members WHERE group_id = ?").run(id);
    const ins = db().prepare("INSERT INTO group_members (group_id, member_id) VALUES (?, ?)");
    for (const m of ids) if (valid.has(m)) ins.run(id, m);
  })();
  revalidatePath("/admin/groups");
  go(`/admin/groups/${id}`, "Group saved.");
}

export async function deleteGroup(fd: FormData) {
  const user = await requireAdmin();
  db().prepare("DELETE FROM groups WHERE id = ? AND ward_id = ?").run(Number(fd.get("item_id")), user.ward_id);
  revalidatePath("/admin/groups");
  go("/admin/groups", "Group deleted.");
}
