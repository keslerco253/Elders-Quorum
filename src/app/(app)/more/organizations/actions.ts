"use server";

import { allowHit, overLimit } from "@/lib/rate-limit";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addToWard } from "@/lib/orgs";
import { wardByJoinCode } from "@/lib/wards";

function go(text: string, ok = true): never {
  redirect(`/more/organizations?${ok ? "ok=1&" : ""}msg=${encodeURIComponent(text)}`);
}

/**
 * Which organizations in this ward the member belongs to, and which they get
 * notifications from. Leaders keep their place (and always get notified).
 */
export async function saveMyOrganizations(fd: FormData) {
  const user = await requireUser();
  const d = db();
  d.transaction(() => {
    for (const o of user.orgs) {
      // Everyone belongs to the ward itself; they only choose its notifications.
      const official = o.kind === "ward" || fd.get(`official_${o.id}`) === "on";
      const notify = fd.get(`notify_${o.id}`) === "on";
      if (official || notify || o.role !== "member") {
        d.prepare(
          `INSERT INTO org_members (org_id, member_id, official, notify) VALUES (?, ?, ?, ?)
           ON CONFLICT(org_id, member_id) DO UPDATE SET official = excluded.official, notify = excluded.notify`,
        ).run(o.id, user.id, official ? 1 : 0, notify ? 1 : 0);
      } else {
        d.prepare("DELETE FROM org_members WHERE org_id = ? AND member_id = ?").run(o.id, user.id);
      }
    }
  })();
  revalidatePath("/", "layout");
  go("Saved.");
}

/** Joins another ward with its join code (e.g. a stake calling, or helping a second ward). */
export async function joinAnotherWard(fd: FormData) {
  const user = await requireUser();
  // Wrong codes are limited per person, so codes can't be guessed.
  if (overLimit(`badjoin:m${user.id}`, 10, 24 * 60)) go("Too many join codes tried. Please try again tomorrow.", false);
  const ward = wardByJoinCode(String(fd.get("join_code") || ""));
  if (!ward) {
    allowHit(`badjoin:m${user.id}`, 10, 24 * 60);
    go("That join code didn't match. Check it with that ward's bishopric.", false);
  }
  if (user.wards.some((w) => w.id === ward.id)) go(`You're already in ${ward.name}.`, false);
  addToWard(user.id, ward.id);
  const wardOrg = db().prepare("SELECT id FROM orgs WHERE ward_id = ? AND kind = 'ward'").get(ward.id) as { id: number };
  revalidatePath("/", "layout");
  // Switch to the new ward so they can choose its organizations.
  redirect(`/more/organizations?org=${wardOrg.id}&ok=1&msg=${encodeURIComponent(`You joined ${ward.name}. Choose your organizations there below.`)}`);
}
