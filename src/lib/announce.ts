import { db } from "./db";
import { audienceMembers, recipientById, type Recipient } from "./notify";
import { getGroup, orgGroups } from "./groups";
import { orgsInWard } from "./orgs";
import { leadersWord, type CurrentUser } from "./types";
import { eventAudience } from "./events";

// "Send a notification" on events and service opportunities: who it can go to.

export interface AnnounceChoice {
  value: string;
  label: string;
}

/** Everyone, the leaders, each group, plus any choices for this item (people who RSVP'd, who signed up). */
/**
 * `invites`: an event that can invite other organizations: a choice for everyone in
 * them, naming them when known (an event being edited).
 */
export function announceChoices(user: CurrentUser, extra: AnnounceChoice[] = [], opts: { invites?: boolean; invitedNames?: string } = {}): AnnounceChoice[] {
  return [
    { value: "everyone", label: `Everyone in ${user.orgLabel}` },
    ...(opts.invites
      ? [{ value: "invited", label: opts.invitedNames ? `Everyone in the invited organizations: ${opts.invitedNames}` : "Everyone in the organizations you invite above" }]
      : []),
    ...extra,
    { value: "presidency", label: `Just the ${leadersWord(user.org)}` },
    ...orgGroups(user.org_id).map((g) => ({ value: `group:${g.id}`, label: `${g.name} (${g.n} ${g.n === 1 ? "person" : "people"})` })),
  ];
}

const byIds = (ids: number[], orgId: number) => ids.map((id) => recipientById(id, orgId)).filter((r): r is Recipient => !!r);

/** The people one choice means. */
function recipientsFor(
  user: CurrentUser,
  raw: string,
  opts: { eventId?: number; signupId?: number; event?: Parameters<typeof eventAudience>[0] },
): Recipient[] {
  const org = user.org_id;
  if (raw === "everyone") return audienceMembers(org, "everyone");
  // Everyone in the organizations an event invited (or the whole ward).
  if (raw === "invited") return opts.event ? eventAudience(opts.event, { invitedOnly: true }) : [];
  if (raw === "presidency") return audienceMembers(org, "presidency");
  if (raw.startsWith("group:")) {
    const g = getGroup(Number(raw.slice(6)), org);
    return g ? audienceMembers(org, `group:${g.id}`) : [];
  }
  // One person, added by name: anyone in this ward.
  if (raw.startsWith("m:")) {
    const id = Number(raw.slice(2));
    const inWard = db().prepare("SELECT 1 FROM ward_members wm JOIN members m ON m.id = wm.member_id WHERE wm.ward_id = ? AND wm.member_id = ? AND m.status = 'active'").get(user.ward_id, id);
    return inWard ? byIds([id], org) : [];
  }
  if (raw === "rsvp" && opts.eventId) {
    const ids = db().prepare("SELECT member_id FROM event_rsvps WHERE event_id = ? AND response IN ('yes','maybe')").all(opts.eventId) as { member_id: number }[];
    return byIds(ids.map((r) => r.member_id), org);
  }
  if (raw === "signed" && opts.signupId) {
    const ids = db()
      .prepare("SELECT DISTINCT e.member_id FROM signup_entries e JOIN signup_slots sl ON sl.id = e.slot_id WHERE sl.signup_id = ?")
      .all(opts.signupId) as { member_id: number }[];
    return byIds(ids.map((r) => r.member_id), org);
  }
  return [];
}

/**
 * Everyone the ticked choices mean, together (groups, people added by name...),
 * each person once. `leadersOnly` (a leaders-only event) always means just the leaders.
 */
export function announceRecipients(
  user: CurrentUser,
  values: string[],
  opts: { leadersOnly?: boolean; eventId?: number; signupId?: number; event?: Parameters<typeof eventAudience>[0] } = {},
): Recipient[] {
  if (opts.leadersOnly) return audienceMembers(user.org_id, "admins");
  const all = values.flatMap((v) => recipientsFor(user, v, opts));
  return all.filter((r, i) => all.findIndex((x) => x.id === r.id) === i);
}

/** The form's ticked choices ("same" means whoever it went to last time), cleaned up. */
export function readTargets(fd: FormData, before: string | null | undefined): string[] {
  const picked = fd.getAll("announce_to").map(String);
  const out = picked.flatMap((v) => (v === "same" ? (before ?? "").split(",") : [v]));
  return [...new Set(out.filter((v) => /^(everyone|invited|presidency|rsvp|signed|group:\d+|m:\d+)$/.test(v)))];
}

/** People in the ward, for adding someone by name. */
export function wardPeople(wardId: number): { id: number; name: string }[] {
  return db()
    .prepare("SELECT m.id, m.display_name AS name FROM members m JOIN ward_members wm ON wm.member_id = m.id WHERE wm.ward_id = ? AND m.status = 'active' ORDER BY m.display_name COLLATE NOCASE")
    .all(wardId) as { id: number; name: string }[];
}

export const notifiedNote = (n: number) => ` ${n} ${n === 1 ? "person was" : "people were"} notified.`;

/** For an organization's event form: the ward's other organizations it can invite. */
export function inviteChoicesFor(user: CurrentUser) {
  if (user.org.kind === "ward") return undefined;
  return orgsInWard(user.ward_id)
    .filter((o) => o.kind === "group" && o.id !== user.org_id)
    .map((o) => ({ id: o.id, label: o.name }));
}

/**
 * On an edit page: "The same people as before" first, when it was announced to
 * someone, describing who that was.
 */
export function withSameAsBefore(choices: AnnounceChoice[], announcedTo: string | null | undefined, people: { id: number; name: string }[]): AnnounceChoice[] {
  const names = (announcedTo ?? "")
    .split(",")
    .filter(Boolean)
    .map((v) => (v.startsWith("m:") ? people.find((p) => p.id === Number(v.slice(2)))?.name : choices.find((c) => c.value === v)?.label))
    .filter(Boolean);
  return names.length ? [{ value: "same", label: `The same people as before: ${names.join(", ")}` }, ...choices] : choices;
}

/** "Relief Society and Primary", or "the whole ward", for an event's invited organizations. */
export function invitedNames(invited: string): string {
  if (invited === "ward") return "the whole ward";
  const names = invited
    .split(",")
    .filter(Boolean)
    .map((id) => (db().prepare("SELECT name FROM orgs WHERE id = ?").get(Number(id)) as { name: string } | undefined)?.name)
    .filter(Boolean) as string[];
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}
