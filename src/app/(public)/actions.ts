"use server";

import { setupCodeMatches } from "@/lib/setup-code";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createLoginToken, findLoginMember, findMemberByContact, isRemember, redeemCode, redeemToken } from "@/lib/auth-core";
import { endSession, startSession } from "@/lib/auth";
import { sendLoginCode } from "@/lib/login-code";
import { parseContact } from "@/lib/contact";
import { phoneEnabled, phoneOptInVisible } from "@/lib/sms";
import { needsSetup, wardByJoinCode } from "@/lib/wards";
import { addToWard, createWard } from "@/lib/orgs";
import { DEFAULT_TZ } from "@/lib/time";
import type { Member } from "@/lib/types";

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

/** Reads the "phone number or email" box. Phone numbers only count once texting is set up. */
function readContact(raw: string) {
  const c = parseContact(raw);
  if (!c || (c.kind === "phone" && !phoneEnabled())) return null;
  return c;
}

function invalidContactMessage(raw: string) {
  if (!phoneEnabled() && parseContact(raw)?.kind === "phone") {
    return phoneOptInVisible()
      ? "Texting is waiting for carrier approval and will be ready soon. Please use your email for now; you can add your mobile number later."
      : "Please enter a valid email address.";
  }
  return phoneOptInVisible() ? "Please enter a valid mobile number or email address." : "Please enter a valid email address.";
}

export async function requestLogin(formData: FormData) {
  const raw = String(formData.get("contact") || "");
  const remember = String(formData.get("remember") || "month");
  const c = readContact(raw);
  if (!c || !isRemember(remember)) redirect("/login?" + q({ contact: raw, error: invalidContactMessage(raw) }));

  const member = findLoginMember(c.value);
  if (!member) {
    const other = findMemberByContact(c.value);
    if (other?.status === "pending") redirect("/login?" + q({ error: "Your request to join is waiting for approval. We'll let you know when it's approved." }));
    if (other?.status === "inactive") redirect("/login?" + q({ error: "This account's access is turned off. Please contact your ward leaders." }));
    redirect("/join?" + q({ contact: raw, notfound: "1" }));
  }
  const res = createLoginToken(member.id, remember);
  if (!res.ok) redirect("/login?" + q({ error: "Too many sign-in codes. Please wait an hour or use the most recent code." }));
  const sent = await sendLoginCode(member, c.kind, res.token, res.code);
  if (!sent) redirect("/login?" + q({ contact: raw, error: "We couldn't send your code just now. Please try again in a few minutes." }));
  redirect("/login/check?" + q({ to: c.value }));
}

export async function verifyCode(formData: FormData) {
  const to = String(formData.get("to") || "");
  const code = String(formData.get("code") || "");
  const result = redeemCode(to, code);
  if (!result) redirect("/login/check?" + q({ to, error: "That code didn't work. Check the newest code and try again." }));
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
  const raw = String(formData.get("contact") || "");
  const code = String(formData.get("join_code") || "").trim();
  function back(error: string): never {
    redirect("/join?" + q({ contact: raw, name, code, error }));
  }
  const c = readContact(raw);
  if (!name) back("Please enter your name.");
  if (!c) back(invalidContactMessage(raw));
  if (formData.get("agree") !== "on") back("Please check the box to show you've read what the app keeps.");
  if (findLoginMember(c.value)) redirect("/login?" + q({ contact: raw, error: "You already have an account. Enter it below to sign in." }));

  const d = db();
  const recent = d.prepare("SELECT COUNT(*) AS n FROM members WHERE source = 'request' AND created_at > datetime('now', '-1 hour')").get() as { n: number };
  if (recent.n >= 20) back("Too many people are joining right now. Please try again later.");

  const ward = wardByJoinCode(code);
  if (!ward) back(code ? "That join code didn't match. Check it with your bishopric or an organization presidency." : "Please enter your ward's join code.");

  const existing = findMemberByContact(c.value);
  if (existing?.status === "inactive") back("This account's access was turned off. Please contact your ward leaders.");
  const pref = c.kind === "phone" ? "text" : "email";
  let memberId: number;
  // The join form's checkbox covers what the app keeps and, for a phone number, consent to texts.
  if (existing) {
    d.prepare("UPDATE members SET name = ?, display_name = ?, status = 'active', request_note = NULL, welcomed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(name, name, existing.id);
    memberId = existing.id;
  } else {
    memberId = Number(
      d
        .prepare(`INSERT INTO members (name, display_name, ${c.kind}, contact_pref, status, source, welcomed_at) VALUES (?, ?, ?, ?, 'active', 'request', datetime('now'))`)
        .run(name, name, c.value, pref).lastInsertRowid,
    );
  }
  addToWard(memberId, ward.id);

  if (c.kind === "phone") d.prepare("UPDATE members SET sms_consent_at = datetime('now') WHERE id = ?").run(memberId);
  const res = createLoginToken(memberId, "month");
  if (res.ok) await sendLoginCode(d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member, c.kind, res.token, res.code);
  // After signing in, they choose the organizations they belong to.
  redirect("/login/check?" + q({ to: c.value }));
}

export async function runSetup(formData: FormData) {
  if (!needsSetup()) redirect("/login");
  const setupCode = process.env.SETUP_CODE;
  if (setupCode && !setupCodeMatches(String(formData.get("setup_code") || ""))) redirect("/setup?" + q({ error: "The setup code is incorrect." }));
  const wardName = String(formData.get("ward_name") || "").trim();
  const timezone = String(formData.get("timezone") || DEFAULT_TZ);
  const name = String(formData.get("name") || "").trim();
  const c = parseContact(String(formData.get("email") || ""));
  if (!wardName || !name || c?.kind !== "email") redirect("/setup?" + q({ error: "Please fill in every field." }));

  const d = db();
  const memberId = Number(
    d.prepare("INSERT INTO members (name, display_name, email, status, source, is_site_owner, welcomed_at) VALUES (?, ?, ?, 'active', 'setup', 1, datetime('now'))").run(name, name, c.value)
      .lastInsertRowid,
  );
  createWard({ name: wardName, timezone, creatorId: memberId });
  const res = createLoginToken(memberId, "year");
  if (res.ok) await sendLoginCode(d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member, "email", res.token, res.code);
  redirect("/login/check?" + q({ to: c.value }));
}
