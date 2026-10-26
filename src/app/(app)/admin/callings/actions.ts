"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency } from "@/lib/auth";
import { orgRoster } from "@/lib/orgs";
import { todayIn } from "@/lib/time";
import { tellRegularTeachers } from "@/lib/regular-teachers";
import {
  callingHolderIds,
  getOrgCalling,
  MAX_CALLING_NAME,
  MAX_CALLINGS,
  setTeacherWeeks,
  stopTeachingIfNone,
  syncLeaderAccess,
} from "@/lib/org-callings";

const PAGE = "/admin/callings";

function go(text: string, hash = ""): never {
  redirect(`${PAGE}?msg=${encodeURIComponent(text)}${hash}`);
}

function refresh() {
  revalidatePath(PAGE);
  revalidatePath("/admin/members", "layout");
  revalidatePath("/admin/lessons", "layout");
  revalidatePath("/lessons", "layout");
}

function details(fd: FormData) {
  const name = String(fd.get("name") || "").trim().replace(/\s+/g, " ").slice(0, MAX_CALLING_NAME);
  if (!name) go("Give the calling a name.");
  return { name, leader: fd.get("leader") ? 1 : 0, teaches: fd.get("teaches") ? 1 : 0 };
}

export async function addCalling(fd: FormData) {
  const user = await requirePresidency();
  const c = details(fd);
  const d = db();
  if ((d.prepare("SELECT COUNT(*) AS n FROM org_callings WHERE org_id = ?").get(user.org_id) as { n: number }).n >= MAX_CALLINGS) go(`Up to ${MAX_CALLINGS} callings.`);
  if (d.prepare("SELECT 1 FROM org_callings WHERE org_id = ? AND lower(name) = lower(?)").get(user.org_id, c.name)) go(`There's already a calling named ${c.name}.`);
  const id = d.prepare("INSERT INTO org_callings (org_id, name, leader, teaches) VALUES (?, ?, ?, ?)").run(user.org_id, c.name, c.leader, c.teaches).lastInsertRowid;
  refresh();
  go(`${c.name} added. Now add the people who hold it.`, `#calling-${id}`);
}

export async function updateCalling(fd: FormData) {
  const user = await requirePresidency();
  const calling = getOrgCalling(user.org_id, Number(fd.get("calling_id")));
  if (!calling) go("That calling was removed.");
  const c = details(fd);
  const d = db();
  if (d.prepare("SELECT 1 FROM org_callings WHERE org_id = ? AND lower(name) = lower(?) AND id <> ?").get(user.org_id, c.name, calling.id)) go(`There's already a calling named ${c.name}.`);
  d.prepare("UPDATE org_callings SET name = ?, leader = ?, teaches = ? WHERE id = ?").run(c.name, c.leader, c.teaches, calling.id);
  const today = todayIn(user.ward.timezone);
  for (const id of callingHolderIds(calling.id)) {
    syncLeaderAccess(user.org_id, id);
    if (calling.teaches && !c.teaches) {
      const changes = stopTeachingIfNone(user.org_id, id, today);
      if (changes) await tellRegularTeachers(user.org_id, user.orgLabel, changes, PAGE);
    }
  }
  refresh();
  go(`${c.name} saved.`, `#calling-${calling.id}`);
}

export async function deleteCalling(fd: FormData) {
  const user = await requirePresidency();
  const calling = getOrgCalling(user.org_id, Number(fd.get("calling_id")));
  if (!calling) go("That calling was already removed.");
  const holders = callingHolderIds(calling.id);
  db().prepare("DELETE FROM org_callings WHERE id = ?").run(calling.id);
  const today = todayIn(user.ward.timezone);
  for (const id of holders) {
    syncLeaderAccess(user.org_id, id);
    if (calling.teaches) {
      const changes = stopTeachingIfNone(user.org_id, id, today);
      if (changes) await tellRegularTeachers(user.org_id, user.orgLabel, changes, PAGE);
    }
  }
  refresh();
  go(`${calling.name} removed.`);
}

export async function addHolder(fd: FormData) {
  const user = await requirePresidency();
  const calling = getOrgCalling(user.org_id, Number(fd.get("calling_id")));
  if (!calling) go("That calling was removed.");
  const memberId = Number(fd.get("member_id"));
  const person = orgRoster(user.org_id).find((p) => p.id === memberId);
  if (!person) go("Choose someone in the organization.", `#calling-${calling.id}`);
  db().prepare("INSERT OR IGNORE INTO member_callings (calling_id, member_id) VALUES (?, ?)").run(calling.id, memberId);
  syncLeaderAccess(user.org_id, memberId);
  refresh();
  go(`${person.display_name} is now ${calling.name}.${calling.teaches ? " Choose the Sundays they teach." : ""}`, `#calling-${calling.id}`);
}

export async function removeHolder(fd: FormData) {
  const user = await requirePresidency();
  const calling = getOrgCalling(user.org_id, Number(fd.get("calling_id")));
  if (!calling) go("That calling was removed.");
  const memberId = Number(fd.get("member_id"));
  db().prepare("DELETE FROM member_callings WHERE calling_id = ? AND member_id = ?").run(calling.id, memberId);
  syncLeaderAccess(user.org_id, memberId);
  if (calling.teaches) {
    const changes = stopTeachingIfNone(user.org_id, memberId, todayIn(user.ward.timezone));
    if (changes) await tellRegularTeachers(user.org_id, user.orgLabel, changes, PAGE);
  }
  refresh();
  go("Removed from the calling.", `#calling-${calling.id}`);
}

export async function saveTeacherWeeks(fd: FormData) {
  const user = await requirePresidency();
  const calling = getOrgCalling(user.org_id, Number(fd.get("calling_id")));
  if (!calling?.teaches) go("That calling doesn't teach.");
  const memberId = Number(fd.get("member_id"));
  if (!callingHolderIds(calling.id).includes(memberId)) go("They no longer hold that calling.", `#calling-${calling.id}`);
  const weeks = [1, 2, 3, 4].filter((w) => fd.get(`week${w}`));
  const changes = setTeacherWeeks(user.org_id, memberId, weeks, todayIn(user.ward.timezone));
  await tellRegularTeachers(user.org_id, user.orgLabel, changes, PAGE);
  refresh();
  go(
    changes.changed
      ? `Teaching Sundays saved.${changes.filled ? ` ${changes.filled} upcoming lesson${changes.filled === 1 ? "" : "s"} filled.` : ""} Teachers added or changed were notified.`
      : "No changes.",
    `#calling-${calling.id}`,
  );
}
