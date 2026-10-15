"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseSlotLines } from "@/lib/signups";
import { saveUpload } from "@/lib/uploads";
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
  // The flyer: a new upload, the one it had, or none.
  const prev = id ? (db().prepare("SELECT flyer_file, flyer_name FROM signups WHERE id = ? AND org_id = ?").get(id, user.org_id) as { flyer_file: string | null; flyer_name: string | null } | undefined) : undefined;
  let flyerFile = fd.get("remove_flyer") === "on" ? null : (prev?.flyer_file ?? null);
  let flyerName = flyerFile ? (prev?.flyer_name ?? null) : null;
  const file = fd.get("flyer");
  if (file instanceof File && file.size > 0) {
    if (file.size > 15_000_000) go(back, "The flyer must be under 15 MB.");
    try {
      flyerFile = await saveUpload(file);
      flyerName = file.name.slice(0, 200) || "Flyer";
      // Recorded with the ward, so only its members can open it.
      db().prepare("INSERT INTO plan_files (name, ward_id, original_name, uploaded_by) VALUES (?, ?, ?, ?)").run(flyerFile, user.ward_id, flyerName, user.id);
    } catch {
      go(back, "That kind of file can't be attached. Use a PDF or a picture (PNG, JPEG, GIF, WebP or an iPhone photo).");
    }
  }
  const d = db();
  const signupId = d.transaction(() => {
    let sid = id;
    if (sid) {
      if (
        !d
          .prepare("UPDATE signups SET title = ?, description = ?, date = ?, closed = ?, flyer_file = ?, flyer_name = ? WHERE id = ? AND org_id = ?")
          .run(title, description, date, closed, flyerFile, flyerName, sid, user.org_id).changes
      )
        return null;
    } else {
      sid = Number(
        d
          .prepare("INSERT INTO signups (org_id, title, description, date, created_by, flyer_file, flyer_name) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(user.org_id, title, description, date, user.id, flyerFile, flyerName).lastInsertRowid,
      );
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
    await notify(audienceMembers(user.org_id, "everyone"), { title: `Service: ${title}`, body: description.slice(0, 200) || "A new service opportunity. Tap to help.", url: `/signups/${signupId}` });
  }
  revalidatePath("/signups", "layout");
  go(`/signups/${signupId}`, "Saved.");
}

export async function deleteSignup(fd: FormData) {
  const user = await requireAdmin();
  db().prepare("DELETE FROM signups WHERE id = ? AND org_id = ?").run(Number(fd.get("item_id")), user.org_id);
  revalidatePath("/signups", "layout");
  go("/signups", "Service opportunity deleted.");
}
