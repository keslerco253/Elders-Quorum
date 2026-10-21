import { db } from "./db";
import { audienceMembers, recipientById, type Recipient } from "./notify";
import { getGroup, orgGroups } from "./groups";
import { leadersWord, type CurrentUser } from "./types";

// "Send a notification" on events and service opportunities: who it can go to.

export interface AnnounceChoice {
  value: string;
  label: string;
}

/** Everyone, the leaders, each group, plus any choices for this item (people who RSVP'd, who signed up). */
export function announceChoices(user: CurrentUser, extra: AnnounceChoice[] = []): AnnounceChoice[] {
  return [
    { value: "everyone", label: `Everyone in ${user.orgLabel}` },
    ...extra,
    { value: "presidency", label: `Just the ${leadersWord(user.org)}` },
    ...orgGroups(user.org_id).map((g) => ({ value: `group:${g.id}`, label: `${g.name} (${g.n} ${g.n === 1 ? "person" : "people"})` })),
  ];
}

const byIds = (ids: number[], orgId: number) => ids.map((id) => recipientById(id, orgId)).filter((r): r is Recipient => !!r);

/** The people a choice means. `leadersOnly` (a leaders-only event) always means just the leaders. */
export function announceRecipients(user: CurrentUser, raw: string, opts: { leadersOnly?: boolean; eventId?: number; signupId?: number } = {}): Recipient[] {
  const org = user.org_id;
  if (opts.leadersOnly) return audienceMembers(org, "admins");
  if (raw === "presidency") return audienceMembers(org, "presidency");
  if (raw.startsWith("group:")) {
    const g = getGroup(Number(raw.slice(6)), org);
    return g ? audienceMembers(org, `group:${g.id}`) : [];
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
  return audienceMembers(org, "everyone");
}

export const notifiedNote = (n: number) => ` ${n} ${n === 1 ? "person was" : "people were"} notified.`;
