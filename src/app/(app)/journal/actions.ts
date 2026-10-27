"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { addJournalEntry, deleteJournalEntry, journalEntry, updateJournalEntry, validDate } from "@/lib/journal";

/**
 * Saves what's been typed (called as they write). A new entry is made the first time
 * there's something in it; after that the same entry is updated.
 */
export async function saveJournalText(input: { id: number | null; date: string; body: string }): Promise<{ id: number | null; error?: string }> {
  const user = await requireUser();
  const body = String(input.body ?? "");
  if (input.id) return updateJournalEntry(user.id, Number(input.id), body) ? { id: Number(input.id) } : { id: null, error: "This entry was deleted." };
  const date = validDate(input.date);
  if (!date) return { id: null, error: "Choose a day." };
  if (!body.trim()) return { id: null };
  return { id: addJournalEntry(user.id, date, body) };
}

export async function deleteJournalEntryAction(fd: FormData) {
  const user = await requireUser();
  const e = journalEntry(user.id, Number(fd.get("entry_id")));
  if (e) deleteJournalEntry(user.id, e.id);
  redirect(`/journal?${new URLSearchParams({ d: e?.date ?? "", msg: "Entry deleted." })}`);
}
