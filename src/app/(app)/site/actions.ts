"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createLoginToken, findMemberByContact, normalizeEmail } from "@/lib/auth-core";
import { sendLoginCode } from "@/lib/login-code";
import { createWard, deleteWard, getWard } from "@/lib/orgs";
import { validZone } from "@/lib/time";
import type { Member } from "@/lib/types";

function go(text: string, error = false): never {
  redirect(`/site?${error ? "error" : "msg"}=${encodeURIComponent(text)}`);
}

async function requireSiteOwner() {
  const user = await requireUser();
  if (!user.is_site_owner) redirect("/");
  return user;
}

/** Texting costs the site owner, so it's turned on ward by ward. */
export async function setWardTexting(fd: FormData) {
  await requireSiteOwner();
  const ward = getWard(Number(fd.get("ward_id")));
  if (!ward) go("That ward is gone.", true);
  const on = fd.get("on") === "1";
  db().prepare("UPDATE wards SET texting_enabled = ? WHERE id = ?").run(on ? 1 : 0, ward.id);
  revalidatePath("/site");
  go(`Texting is ${on ? "on" : "off"} for ${ward.name}.`);
}

export async function removeWard(fd: FormData) {
  const user = await requireSiteOwner();
  const ward = getWard(Number(fd.get("ward_id")));
  if (!ward) go("That ward is gone.", true);
  if (String(fd.get("confirm") || "").trim().toLowerCase() !== ward.name.toLowerCase()) go(`Type ${ward.name} to confirm deleting it.`, true);
  if (user.wards.length === 1 && user.wards[0].id === ward.id) go("That's your only ward. Join or start another one first.", true);
  const { accounts } = deleteWard(ward.id);
  revalidatePath("/", "layout");
  go(`${ward.name} was deleted${accounts ? `, with ${accounts} ${accounts === 1 ? "account" : "accounts"} that weren't in another ward` : ""}.`);
}

/** Starts a ward for someone else (its texting is on, since the site owner made it). */
export async function addWard(fd: FormData) {
  await requireSiteOwner();
  const wardName = String(fd.get("ward_name") || "").trim().slice(0, 80);
  const tz = String(fd.get("timezone") || "");
  const name = String(fd.get("name") || "").trim().slice(0, 100);
  const email = normalizeEmail(String(fd.get("email") || ""));
  if (!wardName || !name || !email.includes("@") || !validZone(tz)) go("Fill in every field to add a ward.", true);
  const d = db();
  const existing = findMemberByContact(email);
  const memberId =
    existing?.id ?? Number(d.prepare("INSERT INTO members (name, display_name, email, source) VALUES (?, ?, ?, 'setup')").run(name, name, email).lastInsertRowid);
  createWard({ name: wardName, timezone: tz, creatorId: memberId, texting: true });
  const res = createLoginToken(memberId, "month");
  if (res.ok) await sendLoginCode(d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member, "email", res.token, res.code);
  revalidatePath("/site");
  go(`${wardName} was added. ${name} was emailed a sign-in link.`);
}
