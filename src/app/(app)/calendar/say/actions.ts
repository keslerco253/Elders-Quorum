"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { addSpokenEvent, eventOrgChoices, readSpokenEvent, sayEventConfigured, type EventDraft, type Step, type Turn } from "@/lib/say-event";

/** Each person's readings in the last hour (to keep the cost in check). */
const recent = new Map<number, number[]>();
const PER_HOUR = 40;

/** Reads what they've said so far: the event as understood, and what to ask next. */
export async function sayEventStep(turns: Turn[]): Promise<{ step?: Step; error?: string }> {
  const user = await requireUser();
  if (user.support) return { error: "Not in support view." };
  if (!sayEventConfigured()) return { error: "Saying an event isn't set up on this server yet (ANTHROPIC_API_KEY)." };
  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 3_600_000);
  if (mine.length >= PER_HOUR) return { error: "That's a lot of events this hour. Please use + My event or Add event for now." };
  recent.set(user.id, [...mine, now]);
  const clean = (Array.isArray(turns) ? turns : [])
    .filter((t) => t && (t.who === "member" || t.who === "app") && typeof t.text === "string")
    .map((t) => ({ who: t.who, text: t.text.slice(0, 1000) }))
    .slice(-12);
  if (!clean.some((t) => t.who === "member" && t.text.trim())) return { error: "Say or type the event first." };
  try {
    const step = await readSpokenEvent(clean, { memberId: user.id, tz: user.ward.timezone, choices: eventOrgChoices(user.id, user.wardAdmin ? user.ward_id : null), currentOrgId: user.org_id });
    return step ? { step } : { error: "I couldn't read that just now. Please try again." };
  } catch (err) {
    console.error("[say-event]", err);
    return { error: "I couldn't read that just now. Please try again in a minute." };
  }
}

/** Adds the event they checked (their own, or an organization's if they may). */
export async function addSaidEvent(draft: EventDraft): Promise<{ error: string } | never> {
  const user = await requireUser();
  if (user.support) return { error: "Not in support view." };
  const added = addSpokenEvent(user.id, draft, eventOrgChoices(user.id, user.wardAdmin ? user.ward_id : null), user.ward.timezone);
  if (!added) return { error: "Something is still missing (a title, a day, or a time). Say it, then add it." };
  revalidatePath("/", "layout");
  redirect(`${added.url}${added.url.includes("?") ? "&" : "?"}msg=${encodeURIComponent(`Added to ${added.where}.`)}`);
}
