"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { phoneOptInVisible, memberTextable } from "@/lib/sms";
import type { ContactPref } from "@/lib/contact";

export async function acceptWelcome(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const back = (msg: string): never => redirect(`/welcome?msg=${encodeURIComponent(msg)}`);
  if (fd.get("agree") !== "on") back("Please check the box to continue.");
  const name = String(fd.get("name") || "").trim().slice(0, 100) || user.display_name;

  const allowed: ContactPref[] = ["none"];
  if (user.email) allowed.push("email");
  if (user.phone && (phoneOptInVisible() && memberTextable(user.id))) allowed.push("text");
  if (user.email && user.phone && (phoneOptInVisible() && memberTextable(user.id))) allowed.push("both");
  const pref = String(fd.get("pref") || "none") as ContactPref;
  if (!allowed.includes(pref)) back("Choose how we should reach you.");
  // Choosing Text or Both on this screen, with the disclosure beside it, is their consent to ward texts.
  const texts = pref === "text" || pref === "both";
  db()
    .prepare(
      `UPDATE members SET name = ?, display_name = ?, contact_pref = ?, welcomed_at = datetime('now'),
         sms_consent_at = ${texts ? "coalesce(sms_consent_at, datetime('now'))" : "NULL"}, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(name, name, pref, user.id);
  redirect("/");
}
