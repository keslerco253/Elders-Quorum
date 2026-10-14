"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { removeAppToken } from "@/lib/push";
import { APP_TOKEN_COOKIE } from "@/lib/native-app";
import { db } from "@/lib/db";
import { createLoginToken, findLoginMember, findMemberByContact, isRemember, redeemCode, redeemToken } from "@/lib/auth-core";
import { endSession, startSession } from "@/lib/auth";
import { sendLoginCode } from "@/lib/login-code";
import { parseContact } from "@/lib/contact";
import { phoneEnabled, phoneOptInVisible } from "@/lib/sms";
import { wardByJoinCode } from "@/lib/wards";
import { addToWard, createWard } from "@/lib/orgs";
import { DEFAULT_TZ, validZone } from "@/lib/time";
import { CALLINGS, isCalling, type Member } from "@/lib/types";

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

/**
 * A test account for Apple and Google app review: REVIEW_LOGIN=email:123456.
 * That email signs in with that code (no email is sent). Leave it unset
 * except while an app version is in review.
 */
function reviewLogin() {
  const [email, code] = (process.env.REVIEW_LOGIN || "").split(":").map((s) => s.trim());
  const c = parseContact(email || "");
  return c?.kind === "email" && /^\d{6}$/.test(code || "") ? { email: c.value, code } : null;
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
  // The app stores' reviewers sign in with a fixed code (REVIEW_LOGIN); nothing is sent.
  if (reviewLogin()?.email === c.value) redirect("/login/check?" + q({ to: c.value }));
  const res = createLoginToken(member.id, remember);
  if (!res.ok) redirect("/login?" + q({ error: "Too many sign-in codes. Please wait an hour or use the most recent code." }));
  const sent = await sendLoginCode(member, c.kind, res.token, res.code);
  if (!sent) redirect("/login?" + q({ contact: raw, error: "We couldn't send your code just now. Please try again in a few minutes." }));
  redirect("/login/check?" + q({ to: c.value }));
}

export async function verifyCode(formData: FormData) {
  const to = String(formData.get("to") || "");
  const code = String(formData.get("code") || "");
  const review = reviewLogin();
  if (review && review.email === parseContact(to)?.value && review.code === code.replace(/\D/g, "")) {
    const member = findLoginMember(review.email);
    if (member) {
      await startSession(member.id, "month");
      redirect("/");
    }
  }
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
  // In the phone app: stop sending this phone the member's notifications.
  const jar = await cookies();
  const appToken = jar.get(APP_TOKEN_COOKIE)?.value;
  if (appToken) {
    removeAppToken(decodeURIComponent(appToken));
    jar.delete(APP_TOKEN_COOKIE);
  }
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

/**
 * Anyone can start a ward: a new account (or an existing one, signed in from
 * More) plus the ward, which they lead until the bishopric is added.
 */
export async function startWard(formData: FormData) {
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const raw = String(formData.get("contact") || "");
  const wardName = String(formData.get("ward_name") || "").trim().slice(0, 80);
  const timezone = String(formData.get("timezone") || DEFAULT_TZ);
  const calling = String(formData.get("calling") || "");
  function back(error: string): never {
    redirect("/start?" + q({ name, contact: raw, ward_name: wardName, error }));
  }
  const c = readContact(raw);
  if (!name || !wardName) back("Please enter your name and your ward's name.");
  if (!c) back(invalidContactMessage(raw));
  if (!validZone(timezone)) back("Please choose your time zone.");
  if (formData.get("agree") !== "on") back("Please check the box to show you've read what the app keeps.");
  if (findMemberByContact(c.value)) {
    redirect("/login?" + q({ contact: raw, error: "You already have an account. Sign in, then start your ward under More → My organizations." }));
  }
  const d = db();
  const recent = d.prepare("SELECT COUNT(*) AS n FROM wards WHERE created_at > datetime('now', '-1 hour')").get() as { n: number };
  if (recent.n >= 10) back("Many wards were started in the last hour. Please try again later.");

  const memberId = Number(
    d
      .prepare(`INSERT INTO members (name, display_name, ${c.kind}, contact_pref, status, source, welcomed_at) VALUES (?, ?, ?, ?, 'active', 'request', datetime('now'))`)
      .run(name, name, c.value, c.kind === "phone" ? "text" : "email").lastInsertRowid,
  );
  if (c.kind === "phone") d.prepare("UPDATE members SET sms_consent_at = datetime('now') WHERE id = ?").run(memberId);
  // The first ward on a brand-new server is the site owner's: its texting is on.
  const first = !(d.prepare("SELECT 1 FROM wards").get());
  if (first) d.prepare("UPDATE members SET is_site_owner = 1 WHERE id = ?").run(memberId);
  createWard({ name: wardName, timezone, creatorId: memberId, calling: isCalling(calling) && CALLINGS.ward.includes(calling) ? calling : null, texting: first });
  const res = createLoginToken(memberId, "month");
  if (res.ok) await sendLoginCode(d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member, c.kind, res.token, res.code);
  redirect("/login/check?" + q({ to: c.value }));
}

