"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";
import { createLoginToken, normalizeEmail } from "@/lib/auth-core";
import { sendLoginEmail } from "@/lib/login-email";
import { emailHtml, sendMail } from "@/lib/mail";
import type { Member } from "@/lib/types";

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
  const user = await requirePresidency();
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  const tz = String(fd.get("timezone") || "");
  if (!name || !validZone(tz)) go("Please enter a name and choose a time zone.");
  db().prepare("UPDATE wards SET name = ?, timezone = ? WHERE id = ?").run(name, tz, user.ward_id);
  revalidatePath("/", "layout");
  go("Settings saved.");
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
  const wardName = String(fd.get("ward_name") || "").trim();
  const tz = String(fd.get("timezone") || "");
  const name = String(fd.get("name") || "").trim();
  const email = normalizeEmail(String(fd.get("email") || ""));
  if (!wardName || !name || !email.includes("@") || !validZone(tz)) go("Fill in every field to add a ward.");
  const d = db();
  const memberId = d.transaction(() => {
    const w = d.prepare("INSERT INTO wards (name, timezone) VALUES (?, ?)").run(wardName, tz);
    return Number(d.prepare("INSERT INTO members (ward_id, name, display_name, email, role, source) VALUES (?, ?, ?, ?, 'presidency', 'setup')").run(w.lastInsertRowid, name, name, email).lastInsertRowid);
  })();
  const res = createLoginToken(memberId, "month");
  if (res.ok) await sendLoginEmail(d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member, res.token, res.code);
  go(`${wardName} was added. ${name} was emailed a sign-in link.`);
}
