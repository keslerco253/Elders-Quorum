"use server";

import { requestWard } from "@/lib/ward-requests";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePresidency, requireUser, requireWardLeader } from "@/lib/auth";
import { addToOrg, createOrg, createWard, deleteOrg, getOrg, inOrgWard, newJoinCode, wardOrg } from "@/lib/orgs";
import { validZone } from "@/lib/time";
import { FEATURES, type Feature } from "@/lib/types";

function go(text: string): never {
  redirect(`/admin/settings?msg=${encodeURIComponent(text)}`);
}


export async function saveWardSettings(fd: FormData) {
  const user = await requireWardLeader();
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  const tz = String(fd.get("timezone") || "");
  if (!name || !validZone(tz)) go("Please enter a name and choose a time zone.");
  db().prepare("UPDATE wards SET name = ?, timezone = ? WHERE id = ?").run(name, tz, user.ward_id);
  revalidatePath("/", "layout");
  go("Settings saved.");
}

/** The organization's name and the features it uses. */
export async function saveOrgSettings(fd: FormData) {
  const user = await requirePresidency();
  const name = String(fd.get("name") || "").trim().slice(0, 60);
  if (user.org.kind === "group" && !name) go("Please enter the organization's name.");
  const hidden = (Object.keys(FEATURES) as Feature[]).filter((f) => fd.get(`feature_${f}`) !== "on");
  db()
    .prepare("UPDATE orgs SET name = CASE WHEN kind = 'group' THEN ? ELSE name END, hidden_features = ? WHERE id = ?")
    .run(name, hidden.join(","), user.org_id);
  revalidatePath("/", "layout");
  go("Saved.");
}

/** The bishopric adds an organization, optionally naming its president. */
export async function addOrganization(fd: FormData) {
  const user = await requireWardLeader();
  const name = String(fd.get("name") || "").trim().slice(0, 60);
  if (!name) go("Enter the organization's name, e.g. Relief Society.");
  if (db().prepare("SELECT 1 FROM orgs WHERE ward_id = ? AND kind = 'group' AND lower(name) = lower(?)").get(user.ward_id, name))
    go(`${user.ward.name} already has ${name}. Turn it on in the list above if it's off.`);
  const hidden = (Object.keys(FEATURES) as Feature[]).filter((f) => fd.get(`feature_${f}`) !== "on");
  const org = createOrg(user.ward_id, name, hidden);
  const leader = Number(fd.get("leader_id"));
  if (leader && inOrgWard(leader, org.id)) addToOrg(leader, org.id, { role: "presidency", calling: "president" });
  revalidatePath("/", "layout");
  go(`${name} was added. Members can now choose it under More → My organizations.`);
}

/** An organization of this ward (not the ward itself), on or off. */
function wardGroup(wardId: number, id: number) {
  const org = getOrg(id);
  return org && org.ward_id === wardId && org.kind === "group" ? org : undefined;
}

/** Turns an organization on or off. Off hides it everywhere but here; nothing in it is deleted. */
export async function setOrganizationActive(fd: FormData) {
  const user = await requireWardLeader();
  const org = wardGroup(user.ward_id, Number(fd.get("org_id")));
  if (!org) go("That organization wasn't found.");
  const on = fd.get("active") === "1";
  db().prepare("UPDATE orgs SET active = ? WHERE id = ?").run(on ? 1 : 0, org.id);
  revalidatePath("/", "layout");
  go(on ? `${org.name} is on. Members can choose it under More → My organizations.` : `${org.name} is off. Its members and everything in it are kept if you turn it back on.`);
}

/** The bishopric picks an organization's president (e.g. one of the standard ones, which start without). */
export async function setOrganizationPresident(fd: FormData) {
  const user = await requireWardLeader();
  const org = wardGroup(user.ward_id, Number(fd.get("org_id")));
  const leader = Number(fd.get("leader_id"));
  if (!org || !leader || !inOrgWard(leader, org.id)) go("Choose who will lead it.");
  addToOrg(leader, org.id, { role: "presidency", calling: "president" });
  revalidatePath("/", "layout");
  go(`${org.name} has a president. They can add their counselors and secretary from Admin → Members while looking at ${org.name}.`);
}

export async function deleteOrganization(fd: FormData) {
  const user = await requireWardLeader();
  const org = wardGroup(user.ward_id, Number(fd.get("org_id")));
  if (!org) go("That organization can't be deleted.");
  deleteOrg(org.id);
  revalidatePath("/", "layout");
  go(`${org.name} and everything in it were deleted.`);
}

/** Joining a ward always takes its code; the bishopric can change it (e.g. if it was shared too widely). */
export async function setJoinCode(fd: FormData) {
  const user = await requireWardLeader();
  const mode = String(fd.get("mode"));
  let code = newJoinCode();
  if (mode === "custom") {
    code = String(fd.get("code") || "").trim().toUpperCase().replace(/\s+/g, "");
    // Long enough that it can't be guessed.
    if (!/^[A-Z0-9-]{6,20}$/.test(code)) go("Use 6–20 letters or numbers for the join code.");
  }
  try {
    db().prepare("UPDATE wards SET join_code = ? WHERE id = ?").run(code, user.ward_id);
  } catch {
    go("Another ward already uses that code. Pick a different one.");
  }
  revalidatePath("/admin/settings");
  revalidatePath("/admin/invite");
  const text = `Join code is now ${code}.`;
  if (fd.get("return") === "/admin/invite") redirect(`/admin/invite?msg=${encodeURIComponent(text)}`);
  go(text);
}

/** The bishopric (or the site owner) starts another ward; they lead it until its bishopric is added. */
export async function startAnotherWard(fd: FormData) {
  const user = await requireUser();
  if (!user.wardLeader && !user.is_site_owner) redirect("/");
  const back = (msg: string): never => redirect(`/admin/settings?msg=${encodeURIComponent(msg)}#start-ward`);
  const name = String(fd.get("ward_name") || "").trim().slice(0, 80);
  const tz = String(fd.get("timezone") || user.ward.timezone);
  if (!name || !validZone(tz)) back("Enter the ward's name and time zone.");
  const recent = db().prepare("SELECT COUNT(*) AS n FROM wards WHERE created_by = ? AND created_at > datetime('now', '-1 day')").get(user.id) as { n: number };
  if (recent.n >= 3 && !user.is_site_owner) back("You've started several wards today. Please try again tomorrow.");
  // Anyone but the site owner asks; the site owner checks it's real and approves it.
  if (!user.is_site_owner) {
    const pending = db().prepare("SELECT 1 FROM ward_requests WHERE member_id = ? AND status = 'pending'").get(user.id);
    if (pending) back("You already have a ward request waiting for approval.");
    await requestWard({
      name: user.display_name,
      contact: user.email ?? user.phone ?? "",
      contact_kind: user.email ? "email" : "phone",
      ward_name: name,
      stake: String(fd.get("stake") || "").trim().slice(0, 80),
      calling: null,
      timezone: tz,
      note: String(fd.get("note") || "").trim().slice(0, 1000),
      member_id: user.id,
    });
    back(`Thanks! Your request to start ${name} was sent. You'll get a message when it's approved.`);
  }
  const ward = createWard({ name, timezone: tz, creatorId: user.id, texting: true });
  revalidatePath("/", "layout");
  redirect(`/admin/settings?org=${wardOrg(ward.id).id}&msg=${encodeURIComponent(`${name} is ready. Share its join code, then turn off any organizations it doesn't use below.`)}`);
}
