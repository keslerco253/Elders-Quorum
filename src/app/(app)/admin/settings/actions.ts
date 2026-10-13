"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";
import { createLoginToken, normalizeEmail } from "@/lib/auth-core";
import { sendLoginCode } from "@/lib/login-code";
import { emailHtml, sendMail } from "@/lib/mail";
import crypto from "crypto";
import { sendSms } from "@/lib/sms";
import { formatPhone } from "@/lib/contact";
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
  if (res.ok) await sendLoginCode(d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member, "email", res.token, res.code);
  go(`${wardName} was added. ${name} was emailed a sign-in link.`);
}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export async function setJoinCode(fd: FormData) {
  const user = await requirePresidency();
  const mode = String(fd.get("mode"));
  let code: string | null = null;
  if (mode === "new") code = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join("");
  else if (mode === "custom") {
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
  const text = code ? `Join code is now ${code}.` : "Join code turned off. New members will need presidency approval.";
  if (fd.get("return") === "/admin/invite") redirect(`/admin/invite?msg=${encodeURIComponent(text)}`);
  go(text);
}

export async function saveTextLimit(fd: FormData) {
  const user = await requirePresidency();
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
  const res = await sendSms(user.ward_id, user.phone, `${user.ward.name}: test text. Texting from the app is working.`, "notice");
  go(res === "sent" ? `Test text sent to ${formatPhone(user.phone)}.` : "The text didn't send. Check the TWILIO_ settings in your .env file.");
}
