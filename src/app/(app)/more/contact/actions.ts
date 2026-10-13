"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseContact, type ContactPref } from "@/lib/contact";
import { confirmContactVerification, startContactVerification } from "@/lib/contact-verify";
import { phoneEnabled } from "@/lib/sms";

function go(text: string, extra = ""): never {
  redirect(`/more/contact?msg=${encodeURIComponent(text)}${extra}`);
}

export async function addContact(fd: FormData) {
  const user = await requireUser();
  const c = parseContact(String(fd.get("value") || ""));
  const wanted = String(fd.get("kind"));
  if (!c || c.kind !== wanted) go(wanted === "phone" ? "Please enter a valid mobile number." : "Please enter a valid email address.");
  if (c.kind === "phone" && !phoneEnabled()) go("Texting isn't set up yet.");
  if (c.kind === "phone" && db().prepare("SELECT 1 FROM members WHERE ward_id = ? AND phone = ? AND id != ?").get(user.ward_id, c.value, user.id)) {
    go("That number is already used by another account.");
  }
  if (c.kind === "email" && db().prepare("SELECT 1 FROM members WHERE ward_id = ? AND lower(email) = ? AND id != ? AND status = 'active'").get(user.ward_id, c.value, user.id)) {
    go("That email is already used by another account.");
  }
  const res = await startContactVerification(user, c.kind, c.value);
  if (!res.ok) go(res.reason);
  redirect(`/more/contact?verify=${res.id}`);
}

export async function confirmContact(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("verify_id"));
  const confirmed = confirmContactVerification(user.id, id, String(fd.get("code") || ""));
  if (!confirmed) go("That code didn't work. Check the newest code and try again.", `&verify=${id}`);
  const hadOther = confirmed.kind === "phone" ? !!user.email : !!user.phone;
  // With both on file, email (free) is the default; members can change it below.
  const pref: ContactPref = hadOther ? "email" : confirmed.kind === "phone" ? "text" : "email";
  try {
    db().prepare(`UPDATE members SET ${confirmed.kind} = ?, contact_pref = ?, updated_at = datetime('now') WHERE id = ?`).run(confirmed.value, pref, user.id);
  } catch {
    go("That number is already used by another account.");
  }
  revalidatePath("/more");
  go(hadOther ? `Added. We'll contact you by email when notifications are off; you can change that below.` : "Added.", "&ok=1");
}

export async function removeContact(fd: FormData) {
  const user = await requireUser();
  const kind = fd.get("kind") === "phone" ? "phone" : "email";
  const other = kind === "phone" ? user.email : user.phone;
  if (!other) go("You need at least one way to sign in, so this one can't be removed.");
  const pref: ContactPref = user.contact_pref === "none" ? "none" : kind === "phone" ? "email" : "text";
  db().prepare(`UPDATE members SET ${kind} = NULL, contact_pref = ?, updated_at = datetime('now') WHERE id = ?`).run(pref, user.id);
  revalidatePath("/more");
  go(kind === "phone" ? "Phone number removed." : "Email removed.", "&ok=1");
}

export async function setContactPref(fd: FormData) {
  const user = await requireUser();
  const pref = String(fd.get("pref")) as ContactPref;
  const allowed: ContactPref[] = ["none"];
  if (user.phone) allowed.push("text");
  if (user.email) allowed.push("email");
  if (user.phone && user.email) allowed.push("both");
  if (!allowed.includes(pref)) go("Choose one of the options shown.");
  db().prepare("UPDATE members SET contact_pref = ?, updated_at = datetime('now') WHERE id = ?").run(pref, user.id);
  revalidatePath("/more/contact");
  go("Saved.", "&ok=1");
}
