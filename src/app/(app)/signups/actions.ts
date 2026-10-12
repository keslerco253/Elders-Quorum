"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function go(id: number, text: string): never {
  redirect(`/signups/${id}?msg=${encodeURIComponent(text)}`);
}

export async function takeSlot(fd: FormData) {
  const user = await requireUser();
  const slotId = Number(fd.get("slot_id"));
  const slot = db()
    .prepare("SELECT sl.id, sl.capacity, s.id AS signup_id, s.closed FROM signup_slots sl JOIN signups s ON s.id = sl.signup_id WHERE sl.id = ? AND s.ward_id = ?")
    .get(slotId, user.ward_id) as { id: number; capacity: number; signup_id: number; closed: number } | undefined;
  if (!slot) redirect("/signups");
  if (slot.closed) go(slot.signup_id, "This sign-up is closed.");
  const note = String(fd.get("note") || "").trim().slice(0, 200);
  const d = db();
  // Check and insert together so two people can't take the last spot at once.
  const ok = d.transaction(() => {
    const n = (d.prepare("SELECT COUNT(*) AS n FROM signup_entries WHERE slot_id = ?").get(slot.id) as { n: number }).n;
    if (n >= slot.capacity) return false;
    d.prepare("INSERT OR IGNORE INTO signup_entries (slot_id, member_id, note) VALUES (?, ?, ?)").run(slot.id, user.id, note);
    return true;
  }).immediate();
  revalidatePath(`/signups/${slot.signup_id}`);
  go(slot.signup_id, ok ? "You're signed up. Thank you!" : "Sorry, that spot just filled up.");
}

export async function leaveSlot(fd: FormData) {
  const user = await requireUser();
  const slotId = Number(fd.get("slot_id"));
  const row = db().prepare("SELECT sl.signup_id FROM signup_slots sl JOIN signups s ON s.id = sl.signup_id WHERE sl.id = ? AND s.ward_id = ?").get(slotId, user.ward_id) as { signup_id: number } | undefined;
  if (!row) redirect("/signups");
  db().prepare("DELETE FROM signup_entries WHERE slot_id = ? AND member_id = ?").run(slotId, user.id);
  revalidatePath(`/signups/${row.signup_id}`);
  go(row.signup_id, "You've been removed from that spot.");
}
