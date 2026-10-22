"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { challengeMemberIds, createChallenge, deleteMyEntry, getChallenge, logEntry, updateChallenge, type ChallengeInput } from "@/lib/challenges";
import { isPresidencyOf } from "@/lib/assignments";
import { notify, recipientById, type Recipient } from "@/lib/notify";
import { homeOf } from "@/lib/orgs";
import { formatDate, todayIn } from "@/lib/time";

function go(path: string, text: string): never {
  redirect(`${path}?msg=${encodeURIComponent(text)}`);
}

const parse = <T,>(raw: FormDataEntryValue | null, fallback: T): T => {
  try {
    return JSON.parse(String(raw ?? "")) as T;
  } catch {
    return fallback;
  }
};

/** The challenge's setup, from the form. */
function readInput(fd: FormData): ChallengeInput {
  return {
    title: String(fd.get("title") || ""),
    starts_on: String(fd.get("starts_on") || ""),
    ends_on: String(fd.get("ends_on") || ""),
    teams: parse<{ id?: number; name: string; orgIds: number[] }[]>(fd.get("teams"), []).map((t) => ({ id: Number(t.id) || undefined, name: String(t.name ?? ""), orgIds: (t.orgIds ?? []).map(Number) })),
    items: parse<{ id?: number; label: string; points: number }[]>(fd.get("items"), []).map((i) => ({ id: Number(i.id) || undefined, label: String(i.label ?? ""), points: Number(i.points) })),
  };
}

/** The presidency that started it changes its name, dates, teams or what counts. */
export async function editChallenge(fd: FormData) {
  const user = await requireUser();
  const c = getChallenge(user.ward_id, Number(fd.get("challenge_id")));
  if (!c || !c.org_id || !isPresidencyOf(user.id, c.org_id)) go("/admin/challenges", "Only the presidency that started it can change it.");
  const res = updateChallenge(user.ward_id, c.id, readInput(fd));
  if ("error" in res) go(`/admin/challenges/${c.id}/edit`, res.error);
  revalidatePath("/", "layout");
  go(`/challenges/${c.id}`, "Challenge updated.");
}

/** A presidency starts a challenge; everyone on the teams is told. */
export async function newChallenge(fd: FormData) {
  const user = await requirePresidency();
  const res = createChallenge(user.ward_id, user.org_id, user.id, readInput(fd));
  if ("error" in res) go("/admin/challenges/new", res.error);
  const c = getChallenge(user.ward_id, res.id)!;
  const recipients = challengeMemberIds(c.id)
    .filter((id) => id !== user.id)
    .map((id) => {
      const home = homeOf(id);
      return home.orgId ? recipientById(id, home.orgId) : undefined;
    })
    .filter((r): r is Recipient => !!r);
  await notify(recipients, {
    title: `Challenge: ${c.title}`,
    body: `${formatDate(c.starts_on, "short")} to ${formatDate(c.ends_on, "short")}. Log what you do and see who's ahead (team totals only).`,
    url: `/challenges/${c.id}`,
  });
  revalidatePath("/", "layout");
  go(`/challenges/${c.id}`, "The challenge is on! Everyone on the teams was told.");
}

/** Logs something a member did, for their team. */
export async function logChallenge(fd: FormData) {
  const user = await requireUser();
  const c = getChallenge(user.ward_id, Number(fd.get("challenge_id")));
  if (!c) redirect("/challenges");
  const error = logEntry(c, user.id, Number(fd.get("team_id")), Number(fd.get("item_id")), Number(fd.get("amount")), todayIn(user.ward.timezone));
  revalidatePath(`/challenges/${c.id}`);
  revalidatePath("/");
  go(`/challenges/${c.id}`, error ?? "Logged. Thank you!");
}

export async function deleteEntry(fd: FormData) {
  const user = await requireUser();
  const c = getChallenge(user.ward_id, Number(fd.get("challenge_id")));
  if (!c) redirect("/challenges");
  deleteMyEntry(c, user.id, Number(fd.get("entry_id")), todayIn(user.ward.timezone));
  revalidatePath(`/challenges/${c.id}`);
  go(`/challenges/${c.id}`, "Removed.");
}

/** The presidency that started it can delete it (and everything logged). */
export async function deleteChallenge(fd: FormData) {
  const user = await requireUser();
  const c = getChallenge(user.ward_id, Number(fd.get("challenge_id")));
  if (!c || !c.org_id || !isPresidencyOf(user.id, c.org_id)) go("/admin/challenges", "Only the presidency that started it can delete it.");
  db().prepare("DELETE FROM challenges WHERE id = ?").run(c.id);
  revalidatePath("/", "layout");
  go("/admin/challenges", "Challenge deleted.");
}
