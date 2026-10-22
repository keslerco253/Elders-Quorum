"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseContact, type ContactPref } from "@/lib/contact";
import { confirmContactVerification, startContactVerification } from "@/lib/contact-verify";
import { phoneEnabled, phoneOptInVisible, memberTextable } from "@/lib/sms";

function go(text: string, extra = ""): never {
  redirect(`/more/contact?msg=${encodeURIComponent(text)}${extra}`);
}

export async function addContact(fd: FormData) {
  const user = await requireUser();
  const c = parseContact(String(fd.get("value") || ""));
  const wanted = String(fd.get("kind"));
  if (!c || c.kind !== wanted) go(wanted === "phone" ? "Please enter a valid mobile number." : "Please enter a valid email address.");
  if (c.kind === "phone" && !(phoneEnabled() && memberTextable(user.id))) go("Texting isn't set up yet.");
  if (c.kind === "phone" && db().prepare("SELECT 1 FROM members WHERE phone = ? AND id != ?").get(c.value, user.id)) {
    go("That number is already used by another account.");
  }
  if (c.kind === "email" && db().prepare("SELECT 1 FROM members WHERE lower(email) = ? AND id != ? AND status = 'active'").get(c.value, user.id)) {
    go("That email is already used by another account.");
  }
  const res = await startContactVerification(user, c.kind, c.value);
  if (!res.ok) go(res.reason);
  // Whether they ticked "Send me reminders and messages by text" goes along to the confirm step.
  redirect(`/more/contact?verify=${res.id}${c.kind === "phone" ? `&texts=${fd.get("texts") === "on" ? 1 : 0}` : ""}`);
}

export async function confirmContact(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("verify_id"));
  const confirmed = confirmContactVerification(user.id, id, String(fd.get("code") || ""));
  if (!confirmed) go("That code didn't work. Check the newest code and try again.", `&verify=${id}`);
  const hadOther = confirmed.kind === "phone" ? !!user.email : !!user.phone;
  // With both on file, email (free) is the default; members can change it below.
  const pref: ContactPref = hadOther ? "email" : confirmed.kind === "phone" ? "text" : "email";
  try {
    db().prepare(`UPDATE members SET ${confirmed.kind} = ?, contact_pref = ?, updated_at = datetime('now') WHERE id = ?`).run(confirmed.value, pref, user.id);
    if (confirmed.kind === "email") db().prepare("UPDATE members SET email_verified_at = datetime('now') WHERE id = ?").run(user.id);
    // Sign-in codes or links sent to the old contact stop working.
    db().prepare("UPDATE login_tokens SET used_at = datetime('now') WHERE member_id = ? AND used_at IS NULL").run(user.id);
    // A new email gets everything, like when joining. A new number does if they ticked
    // "Send me reminders and messages by text" (with the disclosure: their consent to
    // texts); otherwise it's only for sign-in codes. They can change either below.
    const texts = confirmed.kind === "phone" && fd.get("texts") !== "0";
    if (confirmed.kind === "email" || texts) {
      if (texts) db().prepare("UPDATE members SET sms_consent_at = datetime('now') WHERE id = ?").run(user.id);
      db().prepare(`UPDATE members SET ${texts ? "always_text" : "always_email"} = 1, contact_pref = CASE WHEN contact_pref = 'none' THEN 'none' ELSE 'both' END WHERE id = ?`).run(user.id);
    } else {
      db().prepare("UPDATE members SET sms_consent_at = NULL, always_text = 0, contact_pref = CASE WHEN contact_pref = 'text' THEN 'email' ELSE contact_pref END WHERE id = ?").run(user.id);
    }
  } catch {
    go("That number is already used by another account.");
  }
  revalidatePath("/more");
  const said =
    confirmed.kind === "email"
      ? "Added. You'll get every reminder and message by email too; you can change that below."
      : fd.get("texts") !== "0"
        ? "Added. You'll get every reminder and message by text too; you can change that below."
        : "Added. This number is for sign-in codes only; tick Text below anytime to get texts.";
  go(said, "&ok=1");
}

export async function removeContact(fd: FormData) {
  const user = await requireUser();
  const kind = fd.get("kind") === "phone" ? "phone" : "email";
  const other = kind === "phone" ? user.email : user.phone;
  if (!other) go("You need at least one way to sign in, so this one can't be removed.");
  const pref: ContactPref = user.contact_pref === "none" ? "none" : kind === "phone" ? "email" : "text";
  if (kind === "email") db().prepare("UPDATE members SET email_verified_at = NULL WHERE id = ?").run(user.id);
  db().prepare(`UPDATE members SET ${kind} = NULL, contact_pref = ?, ${kind === "phone" ? "sms_consent_at = NULL, always_text = 0, " : "always_email = 0, "}updated_at = datetime('now') WHERE id = ?`).run(pref, user.id);
  revalidatePath("/more");
  go(kind === "phone" ? "Phone number removed." : "Email removed.", "&ok=1");
}

export async function setDelivery(fd: FormData) {
  const user = await requireUser();
  const pref = String(fd.get("pref") || user.contact_pref) as ContactPref;
  const allowed: ContactPref[] = ["none"];
  if (user.phone && (phoneOptInVisible() && memberTextable(user.id))) allowed.push("text");
  if (user.email) allowed.push("email");
  if (user.phone && user.email && (phoneOptInVisible() && memberTextable(user.id))) allowed.push("both");
  if (!allowed.includes(pref)) go("Choose one of the options shown.");
  const alwaysEmail = fd.get("always_email") === "on" && !!user.email ? 1 : 0;
  const alwaysText = fd.get("always_text") === "on" && !!user.phone && (phoneOptInVisible() && memberTextable(user.id)) ? 1 : 0;
  // Choosing any texts here (where the disclosure is shown) is their consent.
  const consent = alwaysText === 1 || pref === "text" || pref === "both";
  db()
    .prepare(
      `UPDATE members SET contact_pref = ?, always_email = ?, always_text = ?, ${consent ? "sms_consent_at = coalesce(sms_consent_at, datetime('now')), " : ""}updated_at = datetime('now') WHERE id = ?`,
    )
    .run(pref, alwaysEmail, alwaysText, user.id);
  revalidatePath("/more/contact");
  go("Saved.", "&ok=1");
}
