"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createLoginToken, findLoginMember, isRemember, normalizeEmail, redeemCode, redeemToken } from "@/lib/auth-core";
import { endSession, startSession } from "@/lib/auth";
import { sendLoginEmail } from "@/lib/login-email";
import { audienceMembers, notify } from "@/lib/notify";
import { listWards, needsSetup } from "@/lib/wards";
import { DEFAULT_TZ } from "@/lib/time";
import type { Member } from "@/lib/types";

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

export async function requestLogin(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") || ""));
  const remember = String(formData.get("remember") || "month");
  if (!email.includes("@") || !isRemember(remember)) redirect("/login?" + q({ error: "Please enter a valid email address." }));

  const member = findLoginMember(email);
  if (!member) {
    const pending = db().prepare("SELECT status FROM members WHERE lower(email) = ? ORDER BY updated_at DESC LIMIT 1").get(email) as { status: string } | undefined;
    if (pending?.status === "pending") redirect("/login?" + q({ error: "Your access request is waiting for approval from the presidency. You'll get an email when it's approved." }));
    if (pending?.status === "inactive" || pending?.status === "declined") redirect("/login?" + q({ error: "This email doesn't have access. Please contact the elders quorum presidency." }));
    redirect("/request-access?" + q({ email, notfound: "1" }));
  }
  const res = createLoginToken(member.id, remember);
  if (!res.ok) redirect("/login?" + q({ error: "Too many sign-in emails. Please wait an hour or use the most recent code." }));
  await sendLoginEmail(member, res.token, res.code);
  redirect("/login/check?" + q({ email }));
}

export async function verifyCode(formData: FormData) {
  const email = String(formData.get("email") || "");
  const code = String(formData.get("code") || "");
  const result = redeemCode(email, code);
  if (!result) redirect("/login/check?" + q({ email, error: "That code didn't work. Check the newest email and try again." }));
  await startSession(result.memberId, result.remember);
  redirect("/");
}

export async function verifyToken(formData: FormData) {
  const result = redeemToken(String(formData.get("token") || ""));
  if (!result) redirect("/login?" + q({ error: "That sign-in link has expired or was already used. Please request a new one." }));
  await startSession(result.memberId, result.remember);
  redirect("/");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}

export async function requestAccess(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));
  const phone = String(formData.get("phone") || "").trim();
  const note = String(formData.get("note") || "").trim().slice(0, 1000);
  const wards = listWards();
  const wardId = Number(formData.get("ward_id") || wards[0]?.id);
  if (!name || !email.includes("@") || !wards.some((w) => w.id === wardId)) {
    redirect("/request-access?" + q({ email, error: "Please fill in your name, email and ward." }));
  }
  if (findLoginMember(email)) redirect("/login?" + q({ error: "You already have access. Enter your email to sign in." }));

  const d = db();
  // Simple guard against someone flooding the presidency with fake requests.
  const recent = d.prepare("SELECT COUNT(*) AS n FROM members WHERE source = 'request' AND updated_at > datetime('now', '-1 hour')").get() as { n: number };
  if (recent.n >= 10) redirect("/request-access?" + q({ email, error: "Too many requests right now. Please try again later or contact the presidency." }));
  const existing = d.prepare("SELECT * FROM members WHERE lower(email) = ? AND ward_id = ?").get(email, wardId) as Member | undefined;
  if (existing) {
    d.prepare("UPDATE members SET status = 'pending', request_note = ?, phone = coalesce(nullif(?, ''), phone), updated_at = datetime('now') WHERE id = ?").run(note, phone, existing.id);
  } else {
    d.prepare("INSERT INTO members (ward_id, name, display_name, email, phone, status, source, request_note) VALUES (?, ?, ?, ?, ?, 'pending', 'request', ?)").run(
      wardId,
      name,
      name,
      email,
      phone || null,
      note,
    );
  }
  await notify(audienceMembers(wardId, "presidency"), { title: "New access request", body: `${name} (${email}) asked for access to the app.`, url: "/admin/access" });
  redirect("/login?" + q({ ok: "Thanks! Your request was sent to the presidency. You'll get an email when it's approved." }));
}

export async function runSetup(formData: FormData) {
  if (!needsSetup()) redirect("/login");
  const setupCode = process.env.SETUP_CODE;
  if (setupCode && String(formData.get("setup_code") || "") !== setupCode) redirect("/setup?" + q({ error: "The setup code is incorrect." }));
  const wardName = String(formData.get("ward_name") || "").trim();
  const timezone = String(formData.get("timezone") || DEFAULT_TZ);
  const name = String(formData.get("name") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!wardName || !name || !email.includes("@")) redirect("/setup?" + q({ error: "Please fill in every field." }));

  const d = db();
  const memberId = d.transaction(() => {
    const ward = d.prepare("INSERT INTO wards (name, timezone) VALUES (?, ?)").run(wardName, timezone);
    const m = d
      .prepare("INSERT INTO members (ward_id, name, display_name, email, role, status, source, is_site_owner) VALUES (?, ?, ?, ?, 'presidency', 'active', 'setup', 1)")
      .run(ward.lastInsertRowid, name, name, email);
    return Number(m.lastInsertRowid);
  })();
  const res = createLoginToken(memberId, "year");
  if (res.ok) await sendLoginEmail(d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member, res.token, res.code);
  redirect("/login/check?" + q({ email }));
}
