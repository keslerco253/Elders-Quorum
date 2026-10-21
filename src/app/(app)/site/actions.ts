"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createLoginToken, findMemberByContact, normalizeEmail } from "@/lib/auth-core";
import { sendLoginCode } from "@/lib/login-code";
import { addToWard, clearWardCalendar, clearWardMessages, clearWardService, createWard, deleteWard, getWard, wardOrg } from "@/lib/orgs";
import { validZone } from "@/lib/time";
import type { Member } from "@/lib/types";
import { emailHtml, sendMail } from "@/lib/mail";
import { sendSms, setTextCost } from "@/lib/sms";
import { formatPhone } from "@/lib/contact";
import { approveWard, declineWard } from "@/lib/ward-review";
import { setUpReviewDemo } from "@/lib/review-demo";
import { type CfmWeek, deleteCfmYear, fetchCfmSchedule, manualUrl, parseCfmContents, saveCfmSchedule } from "@/lib/cfm";

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
  if (on && ward.no_texting) go(`${ward.name} is set to no texting at all. Change that first.`, true);
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

/**
 * Clears what's ticked for a ward (e.g. test data before going live): messages and
 * Reminders & alerts, the calendar, and/or service. Everything else stays.
 */
export async function clearWardData(fd: FormData) {
  await requireSiteOwner();
  const ward = getWard(Number(fd.get("ward_id")));
  if (!ward) go("That ward is gone.", true);
  const what = fd.getAll("what").map(String);
  if (!what.length) go("Tick what to clear.", true);
  if (String(fd.get("confirm") || "").trim().toLowerCase() !== ward.name.toLowerCase()) go(`Type ${ward.name} to confirm.`, true);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const done: string[] = [];
  if (what.includes("messages")) {
    const n = clearWardMessages(ward.id);
    done.push(`${plural(n.messages, "announcement")}, ${plural(n.conversations, "conversation message")}, ${plural(n.alerts, "reminder/alert")}`);
  }
  if (what.includes("calendar")) done.push(plural(clearWardCalendar(ward.id).events, "calendar event"));
  if (what.includes("service")) {
    const n = clearWardService(ward.id).signups;
    done.push(`${n} service ${n === 1 ? "opportunity" : "opportunities"}`);
  }
  revalidatePath("/", "layout");
  go(`${ward.name}: cleared ${done.join("; ")}.`);
}

/** Starts a ward for someone else, with texting on, off (turned on once paid), or none at all. */
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
  const texting = String(fd.get("texting") || "off");
  createWard({ name: wardName, timezone: tz, creatorId: memberId, texting: texting === "on", noTexting: texting === "none" });
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

/**
 * Loads a year's Come, Follow Me schedule: from the Church's website, or from the
 * manual's contents pasted in. Sunday School lessons in every ward fill from it.
 */
export async function loadCfmSchedule(fd: FormData) {
  await requireSiteOwner();
  const year = Number(fd.get("year"));
  if (!Number.isInteger(year) || year < 2025 || year > 2100) go("Choose a year.", true);
  const raw = String(fd.get("manual") || "").trim();
  const manual = /^https:\/\/(www\.)?churchofjesuschrist\.org\/study\/manual\/[\w-]+$/.test(raw.replace(/[?#].*$/, "").replace(/\/$/, "")) ? raw.replace(/[?#].*$/, "").replace(/\/$/, "") : manualUrl(year);
  const pasted = String(fd.get("contents") || "");
  let weeks: CfmWeek[] = [];
  if (pasted.trim()) weeks = parseCfmContents(pasted, year, manual);
  else {
    try {
      weeks = await fetchCfmSchedule(year, manual);
    } catch (e) {
      go(`Couldn't load it from the Church website (${e instanceof Error ? e.message : "no answer"}). Copy the manual's contents and paste them below instead.`, true);
    }
  }
  if (weeks.length < 10) go(`Only ${weeks.length} weeks were found${pasted.trim() ? " in what you pasted" : " on that page"}. Check the manual's address, or paste its contents (each week's dates and reading, like "January 5–11: Moses 1; Abraham 3").`, true);
  saveCfmSchedule(weeks);
  revalidatePath("/", "layout");
  redirect(`/site?msg=${encodeURIComponent(`Come, Follow Me ${year}: ${weeks.length} weeks loaded, ${weeks[0].start} to ${weeks.at(-1)!.sunday}. Check a few below.`)}#cfm`);
}

export async function removeCfmYear(fd: FormData) {
  await requireSiteOwner();
  deleteCfmYear(String(fd.get("year")));
  revalidatePath("/site");
  go("Schedule removed.");
}

/** The demo ward and account the App Store and Google Play reviewers sign in to. */
export async function setUpReview(fd: FormData) {
  const user = await requireSiteOwner();
  const email = normalizeEmail(String(fd.get("email") || ""));
  if (!email) go("Enter an email for the reviewer's account.", true);
  try {
    setUpReviewDemo(email, user.ward.timezone);
  } catch (e) {
    go(e instanceof Error ? e.message : "Couldn't set up the demo.", true);
  }
  revalidatePath("/site");
  redirect(`/site?msg=${encodeURIComponent("The demo ward is ready. Set REVIEW_LOGIN on Northflank as shown below.")}#review`);
}

/**
 * No texting at all for a ward: no reminder or message texts and no sign-in codes by
 * text (members sign in by email). Turning it off again allows texting to be turned on.
 */
export async function setNoTexting(fd: FormData) {
  await requireSiteOwner();
  const ward = getWard(Number(fd.get("ward_id")));
  if (!ward) go("That ward is gone.", true);
  const none = fd.get("none") === "1";
  db().prepare("UPDATE wards SET no_texting = ?, texting_enabled = CASE WHEN ? = 1 THEN 0 ELSE texting_enabled END WHERE id = ?").run(none ? 1 : 0, none ? 1 : 0, ward.id);
  revalidatePath("/", "layout");
  go(none ? `${ward.name} has no texting at all now: members sign in and get everything by email or app notification.` : `${ward.name} can use texting again. Turn it on when they're ready.`);
}

/** Texting is paid through a date: it turns off after it (you're reminded two weeks before). Empty: no end date. */
export async function setPaidThrough(fd: FormData) {
  await requireSiteOwner();
  const ward = getWard(Number(fd.get("ward_id")));
  if (!ward) go("That ward is gone.", true);
  const raw = String(fd.get("paid_through") || "");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  db().prepare("UPDATE wards SET texting_paid_through = ? WHERE id = ?").run(date, ward.id);
  revalidatePath("/site");
  go(date ? `${ward.name}'s texting is paid through ${date}.` : `${ward.name}'s texting has no end date.`);
}

/** What one text costs, to work out each ward's share. */
export async function saveTextCost(fd: FormData) {
  await requireSiteOwner();
  const cost = Number(String(fd.get("cost") || "").replace(/[$\s]/g, ""));
  if (!Number.isFinite(cost) || cost < 0 || cost > 1) go("Enter the cost of one text in dollars, e.g. 0.012.", true);
  setTextCost(cost);
  revalidatePath("/site");
  go(`Cost per text set to $${cost}.`);
}
