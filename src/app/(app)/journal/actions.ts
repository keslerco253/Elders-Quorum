"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  addJournalEntry,
  changeJournalPasscode,
  deleteJournalEntry,
  eraseJournal,
  hasJournalPasscode,
  journalEntry,
  MIN_PASSCODE,
  removeJournalPasscode,
  setJournalPasscode,
  unlockJournal,
  updateJournalEntry,
  validDate,
} from "@/lib/journal";
import { endAllJournalSessions, endJournalSession, journalAccess, startJournalSession } from "@/lib/journal-session";
import { allowHit } from "@/lib/rate-limit";

const TOO_MANY = "Too many tries. Wait 15 minutes and try again.";
const tryPasscode = (memberId: number) => allowHit(`journal-passcode:${memberId}`, 10, 15);

/**
 * Saves what's been typed (called as they write). A new entry is made the first time
 * there's something in it; after that the same entry is updated. "locked": the journal
 * has a passcode and locked itself (the editor asks for the passcode and tries again).
 */
export async function saveJournalText(input: { id: number | null; date: string; body: string }): Promise<{ id: number | null; error?: string }> {
  const user = await requireUser();
  const access = await journalAccess(user.id);
  if (!access) return { id: input.id ? Number(input.id) : null, error: "locked" };
  const body = String(input.body ?? "");
  if (input.id) return updateJournalEntry(user.id, Number(input.id), body, access.mk) ? { id: Number(input.id) } : { id: null, error: "This entry was deleted." };
  const date = validDate(input.date);
  if (!date) return { id: null, error: "Choose a day." };
  if (!body.trim()) return { id: null };
  return { id: addJournalEntry(user.id, date, body, access.mk) };
}

export async function deleteJournalEntryAction(fd: FormData) {
  const user = await requireUser();
  const access = await journalAccess(user.id);
  if (!access) redirect("/journal/unlock");
  const e = journalEntry(user.id, Number(fd.get("entry_id")), access.mk);
  if (e) deleteJournalEntry(user.id, e.id);
  redirect(`/journal?${new URLSearchParams({ d: e?.date ?? "", msg: "Entry deleted." })}`);
}

/** Opens a journal that has a passcode. */
export async function unlockJournalAction(passcode: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!tryPasscode(user.id)) return { ok: false, error: TOO_MANY };
  const key = unlockJournal(user.id, String(passcode || ""));
  if (!key) return { ok: false, error: "That passcode isn't right." };
  await startJournalSession(user.id, key);
  return { ok: true };
}

export async function lockJournalAction() {
  await requireUser();
  await endJournalSession();
  redirect("/journal/unlock");
}

const back = (msg: string): never => redirect(`/journal/passcode?msg=${encodeURIComponent(msg)}`);

function newPasscode(fd: FormData, field = "passcode") {
  const p = String(fd.get(field) || "");
  if (p.trim().length < MIN_PASSCODE) back(`Use at least ${MIN_PASSCODE} characters.`);
  if (p.length > 100) back("That passcode is too long.");
  if (p !== String(fd.get("confirm") || "")) back("The two passcodes don't match.");
  return p;
}

export async function setPasscodeAction(fd: FormData) {
  const user = await requireUser();
  if (hasJournalPasscode(user.id)) back("Your journal already has a passcode.");
  const passcode = newPasscode(fd);
  if (fd.get("understand") !== "on") back("Tick the box to show you understand a forgotten passcode can't be recovered.");
  await startJournalSession(user.id, setJournalPasscode(user.id, passcode));
  redirect(`/journal?msg=${encodeURIComponent("Passcode set. Your journal is locked with it.")}`);
}

export async function changePasscodeAction(fd: FormData) {
  const user = await requireUser();
  const next = newPasscode(fd, "new_passcode");
  if (!tryPasscode(user.id)) back(TOO_MANY);
  if (!changeJournalPasscode(user.id, String(fd.get("current") || ""), next)) back("Your current passcode isn't right.");
  endAllJournalSessions(user.id);
  await startJournalSession(user.id, unlockJournal(user.id, next)!);
  redirect(`/journal?msg=${encodeURIComponent("Passcode changed.")}`);
}

export async function removePasscodeAction(fd: FormData) {
  const user = await requireUser();
  if (!tryPasscode(user.id)) back(TOO_MANY);
  if (!removeJournalPasscode(user.id, String(fd.get("current") || ""))) back("Your passcode isn't right.");
  endAllJournalSessions(user.id);
  await endJournalSession();
  redirect(`/journal?msg=${encodeURIComponent("Passcode turned off.")}`);
}

/** Forgot the passcode: the journal is erased so they can start again. */
export async function eraseJournalAction(fd: FormData) {
  const user = await requireUser();
  if (String(fd.get("confirm") || "").trim().toUpperCase() !== "DELETE") redirect(`/journal/unlock?msg=${encodeURIComponent("Type DELETE to erase your journal.")}`);
  eraseJournal(user.id);
  endAllJournalSessions(user.id);
  await endJournalSession();
  redirect(`/journal?msg=${encodeURIComponent("Your journal was erased. You can start a new one.")}`);
}
