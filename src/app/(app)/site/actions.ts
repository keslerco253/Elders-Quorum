"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createLoginToken, findMemberByContact, normalizeEmail } from "@/lib/auth-core";
import { sendLoginCode } from "@/lib/login-code";
import { addToWard, createWard, deleteWard, getWard, wardOrg } from "@/lib/orgs";
import { validZone } from "@/lib/time";
import type { Member } from "@/lib/types";
import { emailHtml, sendMail } from "@/lib/mail";
import { sendSms } from "@/lib/sms";
import { formatPhone } from "@/lib/contact";
import { approveWard, declineWard } from "@/lib/ward-review";

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

/** A way back in: the site owner joins a ward's bishopric (as an admin there), e.g. after losing access. */
export async function leadWard(fd: FormData) {
  const user = await requireSiteOwner();
  const ward = getWard(Number(fd.get("ward_id")));
  if (!ward) go("That ward is gone.", true);
  const org = wardOrg(ward.id);
  addToWard(user.id, ward.id);
  db().prepare("UPDATE org_members SET role = 'presidency' WHERE org_id = ? AND member_id = ? AND role <> 'presidency'").run(org.id, user.id);
  revalidatePath("/", "layout");
  redirect(`/admin?org=${org.id}`);
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

/** Each ward's monthly limit on reminder and message texts (they're on the site owner's Twilio account). */
export async function saveTextLimit(fd: FormData) {
  await requireSiteOwner();
  const ward = getWard(Number(fd.get("ward_id")));
  if (!ward) go("That ward is gone.", true);
  const limit = Math.round(Number(fd.get("limit")));
  if (!Number.isFinite(limit) || limit < 0 || limit > 100_000) go("Enter a number of texts between 0 and 100,000.", true);
  db().prepare("UPDATE wards SET sms_monthly_limit = ? WHERE id = ?").run(limit, ward.id);
  revalidatePath("/site");
  go(`${ward.name}: monthly text limit set to ${limit}.`);
}

export async function sendTestEmail() {
  const user = await requireSiteOwner();
  if (!user.email) go("Your account has no email address.", true);
  const ok = await sendMail({ to: user.email, subject: "Test email", text: "Email is working.", html: emailHtml("It works!", "Email from the app is working.") });
  go(ok ? `Test email sent to ${user.email}.` : "Sending failed. Check SMTP_USER and SMTP_PASS in the server's settings.", !ok);
}

export async function sendTestText() {
  const user = await requireSiteOwner();
  if (!user.phone) go("Add your mobile number under More → Contact & notifications first.", true);
  if (!user.sms_consent_at) go("Turn on texts under More → Contact & notifications first, so the app may text you.", true);
  const res = await sendSms(user.org_id, user.phone, `${user.ward.name}: test text. Texting from the app is working.`, "notice");
  go(res === "sent" ? `Test text sent to ${formatPhone(user.phone)}.` : "The text didn't send. Check the TWILIO_ settings on the server and that texting is on for this ward.", res !== "sent");
}

/** Approves a new ward (after checking it's real): it opens, and whoever started it is told. */
export async function approveNewWard(fd: FormData) {
  await requireSiteOwner();
  const w = await approveWard(Number(fd.get("ward_id")));
  if (!w) go("That ward was already handled.", true);
  revalidatePath("/", "layout");
  go(`${w.name} is approved. ${w.creator ?? "Whoever started it"} was told.`);
}

export async function declineNewWard(fd: FormData) {
  await requireSiteOwner();
  const w = await declineWard(Number(fd.get("ward_id")), String(fd.get("note") || "").trim().slice(0, 500));
  if (!w) go("That ward was already handled.", true);
  revalidatePath("/", "layout");
  go(`${w.name} was declined and deleted.`);
}
