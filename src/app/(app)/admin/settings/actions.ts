"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency, requireWardLeader } from "@/lib/auth";
import { createLoginToken, findMemberByContact, normalizeEmail } from "@/lib/auth-core";
import { addToOrg, createOrg, createWard, deleteOrg, inOrgWard, newJoinCode } from "@/lib/orgs";
import { sendLoginCode } from "@/lib/login-code";
import { emailHtml, sendMail } from "@/lib/mail";
import { sendSms } from "@/lib/sms";
import { formatPhone } from "@/lib/contact";
import { FEATURES, type Feature, type Member } from "@/lib/types";

function go(text: string): never {
  redirect(`/admin/settings?msg=${encodeURIComponent(text)}`);
}

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export async function saveWardSettings(fd: FormData) {
  const user = await requireWardLeader();
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  const tz = String(fd.get("timezone") || "");
  if (!name || !validZone(tz)) go("Please enter a name and choose a time zone.");
  db().prepare("UPDATE wards SET name = ?, timezone = ? WHERE id = ?").run(name, tz, user.ward_id);
  revalidatePath("/", "layout");
  go("Settings saved.");
}

/** The organization's name and the features it uses. */
export async function saveOrgSettings(fd: FormData) {
  const user = await requirePresidency();
  const name = String(fd.get("name") || "").trim().slice(0, 60);
  if (user.org.kind === "group" && !name) go("Please enter the organization's name.");
  const hidden = (Object.keys(FEATURES) as Feature[]).filter((f) => fd.get(`feature_${f}`) !== "on");
  db()
    .prepare("UPDATE orgs SET name = CASE WHEN kind = 'group' THEN ? ELSE name END, hidden_features = ? WHERE id = ?")
    .run(name, hidden.join(","), user.org_id);
  revalidatePath("/", "layout");
  go("Saved.");
}

/** The bishopric adds an organization, optionally naming its president. */
export async function addOrganization(fd: FormData) {
  const user = await requireWardLeader();
  const name = String(fd.get("name") || "").trim().slice(0, 60);
  if (!name) go("Enter the organization's name, e.g. Relief Society.");
  if (user.orgs.some((o) => o.kind === "group" && o.name.toLowerCase() === name.toLowerCase())) go(`${user.ward.name} already has ${name}.`);
  const hidden = (Object.keys(FEATURES) as Feature[]).filter((f) => fd.get(`feature_${f}`) !== "on");
  const org = createOrg(user.ward_id, name, hidden);
  const leader = Number(fd.get("leader_id"));
  if (leader && inOrgWard(leader, org.id)) addToOrg(leader, org.id, { role: "presidency", calling: "president" });
  revalidatePath("/", "layout");
  go(`${name} was added. Members can now choose it under More → My organizations.`);
}

export async function deleteOrganization(fd: FormData) {
  const user = await requireWardLeader();
  const org = user.orgs.find((o) => o.id === Number(fd.get("org_id")));
  if (!org || org.kind !== "group") go("That organization can't be deleted.");
  if (String(fd.get("confirm") || "").trim().toLowerCase() !== org.name.toLowerCase()) go(`Type ${org.name} to confirm deleting it.`);
  deleteOrg(org.id);
  revalidatePath("/", "layout");
  go(`${org.name} and everything in it were deleted.`);
}

export async function sendTestEmail() {
  const user = await requirePresidency();
  if (!user.email) go("Your account has no email address.");
  const ok = await sendMail({ to: user.email, subject: "Test email", text: "Email is working.", html: emailHtml("It works!", "Email from the app is working.") });
  go(ok ? `Test email sent to ${user.email}.` : "Sending failed. Check SMTP_USER and SMTP_PASS in your settings file.");
}

export async function addWard(fd: FormData) {
  const user = await requirePresidency();
  if (!user.is_site_owner) go("Only the site owner can add wards.");
  const wardName = String(fd.get("ward_name") || "").trim().slice(0, 80);
  const tz = String(fd.get("timezone") || "");
  const name = String(fd.get("name") || "").trim().slice(0, 100);
  const email = normalizeEmail(String(fd.get("email") || ""));
  if (!wardName || !name || !email.includes("@") || !validZone(tz)) go("Fill in every field to add a ward.");
  const d = db();
  const existing = findMemberByContact(email);
  const memberId =
    existing?.id ?? Number(d.prepare("INSERT INTO members (name, display_name, email, source) VALUES (?, ?, ?, 'setup')").run(name, name, email).lastInsertRowid);
  createWard({ name: wardName, timezone: tz, creatorId: memberId });
  const res = createLoginToken(memberId, "month");
  if (res.ok) await sendLoginCode(d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member, "email", res.token, res.code);
  go(`${wardName} was added. ${name} was emailed a sign-in link.`);
}

/** Joining a ward always takes its code; the bishopric can change it (e.g. if it was shared too widely). */
export async function setJoinCode(fd: FormData) {
  const user = await requireWardLeader();
  const mode = String(fd.get("mode"));
  let code = newJoinCode();
  if (mode === "custom") {
    code = String(fd.get("code") || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9-]{4,20}$/.test(code)) go("Use 4–20 letters or numbers for the join code.");
  }
  try {
    db().prepare("UPDATE wards SET join_code = ? WHERE id = ?").run(code, user.ward_id);
  } catch {
    go("Another ward already uses that code. Pick a different one.");
  }
  revalidatePath("/admin/settings");
  revalidatePath("/admin/invite");
  const text = `Join code is now ${code}.`;
  if (fd.get("return") === "/admin/invite") redirect(`/admin/invite?msg=${encodeURIComponent(text)}`);
  go(text);
}

export async function saveTextLimit(fd: FormData) {
  const user = await requireWardLeader();
  const limit = Math.round(Number(fd.get("limit")));
  if (!Number.isFinite(limit) || limit < 0 || limit > 100_000) go("Enter a number of texts between 0 and 100,000.");
  db().prepare("UPDATE wards SET sms_monthly_limit = ? WHERE id = ?").run(limit, user.ward_id);
  revalidatePath("/admin/settings");
  go(`Monthly text limit set to ${limit}.`);
}

export async function sendTestText() {
  const user = await requirePresidency();
  if (!user.phone) go("Add your mobile number under More → Contact & notifications first.");
  if (!user.sms_consent_at) go("Turn on texts under More → Contact & notifications first, so the app may text you.");
  const res = await sendSms(user.org_id, user.phone, `${user.ward.name}: test text. Texting from the app is working.`, "notice");
  go(res === "sent" ? `Test text sent to ${formatPhone(user.phone)}.` : "The text didn't send. Check the TWILIO_ lines in the settings file (OPEN-SETTINGS.bat), then run UPDATE.bat.");
}
