"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getShare } from "@/lib/public-shares";
import { confirmGuest, sendGuestConfirmation, slotTaken, startGuestSignup } from "@/lib/guest-signups";
import { parseContact } from "@/lib/contact";
import { allowHit, clientIp } from "@/lib/rate-limit";
import { orgHasNoTexting, phoneEnabled } from "@/lib/sms";

const q = (p: Record<string, string>) => new URLSearchParams(p).toString();

/** Someone without an account signs up from a public link: saved, then confirmed with a code. */
export async function guestSignUp(fd: FormData) {
  const token = String(fd.get("token") || "");
  const share = getShare(token);
  if (!share || share.kind !== "signup") redirect(`/p/${token}`);
  const name = String(fd.get("name") || "").trim().slice(0, 100);
  const raw = String(fd.get("contact") || "").trim();
  const note = String(fd.get("note") || "").trim().slice(0, 200);
  const textConsent = fd.get("text_consent") === "on";
  const slotId = Number(fd.get("slot_id"));
  const back = (error: string): never => redirect(`/p/${token}?${q({ error, name, contact: raw, note })}#signup`);
  const c = parseContact(raw);
  if (!name) back("Please enter your name.");
  const texting = phoneEnabled() && !orgHasNoTexting(share.org_id);
  if (!c || (c.kind === "phone" && !texting)) return back(texting ? "Please enter a mobile number or an email address." : "Please enter your email address.");
  if (c.kind === "phone" && !textConsent) back("To use a mobile number, tick the box to agree to texts. Or use an email address instead.");
  const slot = db()
    .prepare("SELECT sl.id, sl.capacity, s.closed, s.date FROM signup_slots sl JOIN signups s ON s.id = sl.signup_id WHERE sl.id = ? AND s.id = ?")
    .get(slotId, share.signup_id) as { id: number; capacity: number; closed: number; date: string | null } | undefined;
  if (!slot) return back("Please choose a spot.");
  if (slot.closed) back("Sign-ups for this are closed.");
  if (slotTaken(slot.id) >= slot.capacity) back("Sorry, that spot just filled up. Please choose another.");
  // Limits so the form can't be used to send lots of texts or emails.
  const ip = clientIp(await headers());
  if (!allowHit(`guest:${ip}`, 8, 60) || !allowHit(`guest-share:${token}`, 200, 24 * 60)) back("Too many sign-ups from here right now. Please try again later.");
  const id = await startGuestSignup({ slotId: slot.id, name, contact: c.value, kind: c.kind, note, textConsent: c.kind === "phone" && textConsent });
  if (!id) back("Something went wrong. Please try again.");
  redirect(`/p/${token}?${q({ confirm: String(id), via: c.kind })}#signup`);
}

export async function guestConfirm(fd: FormData) {
  const token = String(fd.get("token") || "");
  const id = Number(fd.get("guest_id"));
  const result = confirmGuest(id, String(fd.get("code") || ""));
  if (result === "ok") {
    await sendGuestConfirmation(id, token);
    redirect(`/p/${token}?done=1#signup`);
  }
  const msg =
    result === "wrong" ? "That code didn't work. Check it and try again." : result === "full" ? "Sorry, that spot filled up before you confirmed. Please choose another." : "That code has expired. Please sign up again.";
  redirect(`/p/${token}?${q(result === "wrong" ? { confirm: String(id), via: String(fd.get("via") || ""), error: msg } : { error: msg })}#signup`);
}
