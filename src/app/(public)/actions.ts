"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createLoginToken, findLoginMember, isRemember, normalizeEmail, redeemCode, redeemToken } from "@/lib/auth-core";
import { endSession, startSession } from "@/lib/auth";
import { sendLoginEmail } from "@/lib/login-email";
import { audienceMembers, notify } from "@/lib/notify";
import { listWards, needsSetup, wardByJoinCode } from "@/lib/wards";
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
    if (pending?.status === "inactive") redirect("/login?" + q({ error: "This email doesn't have access. Please contact the elders quorum presidency." }));
    redirect("/join?" + q({ email, notfound: "1" }));
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

export async function joinApp(formData: FormData) {
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const email = normalizeEmail(String(formData.get("email") || ""));
  const code = String(formData.get("join_code") || "").trim();
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  function back(error: string): never {
    redirect("/join?" + q({ email, name, code, error }));
  }
  if (!name || !email.includes("@")) back("Please enter your name and email.");
  if (formData.get("agree") !== "on") back("Please check the box to show you've read what the app keeps.");
  if (findLoginMember(email)) redirect("/login?" + q({ email, error: "You already have an account. Enter your email to sign in." }));

  const d = db();
  const recent = d.prepare("SELECT COUNT(*) AS n FROM members WHERE source = 'request' AND created_at > datetime('now', '-1 hour')").get() as { n: number };
  if (recent.n >= 20) back("Too many people are joining right now. Please try again later.");

  let ward = code ? wardByJoinCode(code) : undefined;
  if (code && !ward) back("That join code didn't match. Check with the presidency, or leave it blank to send a request instead.");
  const wards = listWards();
  if (!ward) ward = wards.find((w) => w.id === Number(formData.get("ward_id"))) ?? (wards.length === 1 ? wards[0] : undefined);
  if (!ward) back("Please choose your ward.");

  const existing = d.prepare("SELECT * FROM members WHERE lower(email) = ? AND ward_id = ?").get(email, ward.id) as Member | undefined;
  if (existing?.status === "inactive") back("This email's access was turned off. Please contact the elders quorum presidency.");
  const status = code ? "active" : "pending";
  let memberId: number;
  if (existing) {
    d.prepare("UPDATE members SET name = ?, display_name = ?, status = ?, request_note = ?, updated_at = datetime('now') WHERE id = ?").run(name, name, status, code ? null : note, existing.id);
    memberId = existing.id;
  } else {
    memberId = Number(
      d.prepare("INSERT INTO members (ward_id, name, display_name, email, status, source, request_note) VALUES (?, ?, ?, ?, ?, 'request', ?)").run(ward.id, name, name, email, status, code ? null : note).lastInsertRowid,
    );
  }

  if (code) {
    const res = createLoginToken(memberId, "month");
    if (res.ok) await sendLoginEmail(d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member, res.token, res.code);
    redirect("/login/check?" + q({ email }));
  }
  await notify(audienceMembers(ward.id, "presidency"), { title: "New request to join", body: `${name} (${email}) asked to join the app.`, url: "/admin/access" });
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
