import { db } from "./db";
import { audienceMembers, type Audience } from "./notify";
import { canSendTo, orgGroups } from "./groups";
import { getOrg, getWard, hasFeature, myOrgs, orgLabel, orgRoster } from "./orgs";
import { contactLabel, ledOrgIds, presidencyContacts } from "./conversations";
import { leadersWord } from "./types";

// What a leader can send from Messages → New message: an announcement to a whole
// organization, its presidency, upcoming teachers or a message group, or a personal
// message to one person. Values: "aud:<orgId>:<audience>" and "person:<orgId>:<memberId>".

export interface AudienceChoice {
  value: string;
  label: string;
  count: number;
}

export interface OrgChoices {
  orgId: number;
  label: string;
  audiences: AudienceChoice[];
}

export interface PersonChoice {
  value: string;
  name: string;
  orgLabel: string;
}

/** Everything this leader can send to, in every organization they lead. */
export function composeChoices(viewerId: number): { orgs: OrgChoices[]; people: PersonChoice[] } {
  const orgs: OrgChoices[] = [];
  const people = new Map<number, PersonChoice>();
  for (const orgId of ledOrgIds(viewerId)) {
    const org = getOrg(orgId);
    if (!org) continue;
    const ward = getWard(org.ward_id);
    const tz = ward?.timezone;
    const label = org.kind === "ward" ? orgLabel(org, ward) : `${org.name}`;
    const aud = (a: Audience, text: string): AudienceChoice => ({ value: `aud:${orgId}:${a}`, label: text, count: audienceMembers(orgId, a, { tz }).length });
    const audiences = [
      aud("everyone", `Everyone in ${label}`),
      aud("presidency", `The ${leadersWord(org)}`),
      ...(hasFeature(org, "lessons") ? [aud("teachers", "Upcoming teachers (next 5 weeks)")] : []),
      ...orgGroups(orgId)
        .filter((g) => canSendTo(g, viewerId, "presidency"))
        .map((g) => aud(`group:${g.id}`, `Group: ${g.name}`)),
    ];
    orgs.push({ orgId, label, audiences });
    for (const p of orgRoster(orgId)) {
      if (p.id !== viewerId && !people.has(p.id)) people.set(p.id, { value: `person:${orgId}:${p.id}`, name: p.display_name, orgLabel: label });
    }
  }
  // Wards first, then organizations, as in the organization menu.
  const kind = (id: number) => (getOrg(id)?.kind === "ward" ? 0 : 1);
  orgs.sort((a, b) => kind(a.orgId) - kind(b.orgId) || a.label.localeCompare(b.label));
  return { orgs, people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

export interface SentAnnouncement {
  id: number;
  org_id: number;
  audience: string;
  audience_label: string;
  title: string;
  body: string;
  push_count: number;
  email_count: number;
  text_count: number;
  created_at: string;
  sender: string | null;
  org_label: string;
  flyer_file: string | null;
  flyer_name: string | null;
}

/** Messages sent to groups of people in the organizations this leader leads (groups only if they may see them), newest first. */
export function sentAnnouncements(viewerId: number, limit = 40): SentAnnouncement[] {
  const ids = ledOrgIds(viewerId);
  if (!ids.length) return [];
  const rows = db()
    .prepare(
      `SELECT msg.id, msg.org_id, msg.audience, msg.audience_label, msg.title, msg.body, msg.push_count, msg.email_count, msg.text_count, msg.created_at, msg.flyer_file, msg.flyer_name,
         m.display_name AS sender, CASE WHEN o.kind = 'ward' THEN w.name ELSE o.name END AS org_label
       FROM messages msg JOIN orgs o ON o.id = msg.org_id JOIN wards w ON w.id = o.ward_id LEFT JOIN members m ON m.id = msg.sender_id
       WHERE msg.org_id IN (${ids.map(() => "?").join(",")})
       ORDER BY msg.id DESC LIMIT ?`,
    )
    .all(...ids, limit * 2) as SentAnnouncement[];
  return rows
    .filter((r) => {
      const g = r.audience.match(/^group:(\d+)$/);
      if (!g) return true;
      const group = orgGroups(r.org_id).find((x) => x.id === Number(g[1]));
      return !!group && canSendTo(group, viewerId, "presidency");
    })
    .slice(0, limit);
}

export interface MemberChoice {
  value: string;
  label: string;
}

export interface MemberOrgChoices {
  orgId: number;
  label: string;
  choices: MemberChoice[];
}

/**
 * Who a member can write to from New message, in each of their organizations: its whole
 * presidency (or bishopric), one of them privately, or a message group that lets members send.
 * Values: "p:<orgId>:0" (everyone in the presidency), "p:<orgId>:<leaderId>", "g:<orgId>:<groupId>".
 */
export function memberComposeChoices(memberId: number): MemberOrgChoices[] {
  const out: MemberOrgChoices[] = [];
  for (const o of myOrgs(memberId)) {
    const contacts = presidencyContacts(o.id).filter((c) => c.id !== memberId);
    const choices: MemberChoice[] = [];
    if (contacts.length) {
      choices.push({ value: `p:${o.id}:0`, label: `The whole ${leadersWord(o)}` });
      for (const c of contacts) choices.push({ value: `p:${o.id}:${c.id}`, label: `Only ${contactLabel(c, o)} (private)` });
    }
    for (const g of orgGroups(o.id).filter((g) => canSendTo(g, memberId, o.role))) choices.push({ value: `g:${o.id}:${g.id}`, label: `Group: ${g.name}` });
    if (choices.length) out.push({ orgId: o.id, label: o.label, choices });
  }
  return out;
}
