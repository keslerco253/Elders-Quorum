"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseSlotLines } from "@/lib/signups";
import { audienceMembers, notify } from "@/lib/notify";

function go(path: string, text: string): never {
  redirect(`${path}?msg=${encodeURIComponent(text)}`);
}

export async function saveSignup(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(fd.get("item_id")) || null;
  const title = String(fd.get("title") || "").trim();
  const description = String(fd.get("description") || "").trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("date"))) ? String(fd.get("date")) : null;
  const closed = fd.get("closed") === "on" ? 1 : 0;
  const slots = parseSlotLines(String(fd.get("slots") || ""));
  const back = id ? `/admin/signups/${id}` : "/admin/signups/new";
  if (!title || !slots.length) go(back, "Add a title and at least one slot.");
  const d = db();
  const signupId = d.transaction(() => {
    let sid = id;
    if (sid) {
      if (!d.prepare("UPDATE signups SET title = ?, description = ?, date = ?, closed = ? WHERE id = ? AND ward_id = ?").run(title, description, date, closed, sid, user.ward_id).changes) return null;
    } else {
      sid = Number(d.prepare("INSERT INTO signups (ward_id, title, description, date, created_by) VALUES (?, ?, ?, ?, ?)").run(user.ward_id, title, description, date, user.id).lastInsertRowid);
    }
    // Keep slots (and who signed up) when the label is unchanged.
    const existing = d.prepare("SELECT id, label FROM signup_slots WHERE signup_id = ?").all(sid) as { id: number; label: string }[];
    const keep = new Set<number>();
    slots.forEach((s, i) => {
      const match = existing.find((e) => e.label === s.label && !keep.has(e.id));
      if (match) {
        keep.add(match.id);
        d.prepare("UPDATE signup_slots SET capacity = ?, position = ? WHERE id = ?").run(s.capacity, i, match.id);
      } else {
        d.prepare("INSERT INTO signup_slots (signup_id, label, capacity, position) VALUES (?, ?, ?, ?)").run(sid, s.label, s.capacity, i);
      }
    });
    for (const e of existing) if (!keep.has(e.id)) d.prepare("DELETE FROM signup_slots WHERE id = ?").run(e.id);
    return sid;
  })();
  if (!signupId) redirect("/signups");
  if (!id && fd.get("announce") === "on") {
    await notify(audienceMembers(user.ward_id, "everyone"), { title: `Sign-up: ${title}`, body: description.slice(0, 200) || "A new sign-up is open. Tap to help.", url: `/signups/${signupId}` });
  }
  revalidatePath("/signups", "layout");
  go(`/signups/${signupId}`, "Sign-up saved.");
}

export async function deleteSignup(fd: FormData) {
  const user = await requireAdmin();
  db().prepare("DELETE FROM signups WHERE id = ? AND ward_id = ?").run(Number(fd.get("item_id")), user.ward_id);
  revalidatePath("/signups", "layout");
  go("/signups", "Sign-up deleted.");
}
