import { db } from "./db";
import { ledOrgIds } from "./conversations";
import { canSendTo, getGroup } from "./groups";
import { audienceMembers, recipientById, type Audience } from "./notify";
import { getOrg, getWard } from "./orgs";

export type PhonePerson = { id: number; name: string; phone: string | null };

/**
 * Who "Text from my phone" texts for a Messages → New choice ("aud:<org>:everyone",
 * "person:<org>:<id>"…), in an organization the leader leads, where the ward has it
 * turned on. Not the leader themselves. Null when it can't be used for that choice.
 */
export function phoneTextList(user: { id: number }, to: string): { orgId: number; label: string; people: PhonePerson[] } | null {
  const m = to.match(/^(aud|person):(\d+):(.+)$/);
  if (!m) return null;
  const orgId = Number(m[2]);
  const org = getOrg(orgId);
  if (!org || !ledOrgIds(user.id).includes(orgId) || !getWard(org.ward_id)?.phone_texting) return null;
  let list: { id: number; display_name: string; phone: string | null }[] = [];
  let label = "";
  if (m[1] === "person") {
    const id = Number(m[3]);
    const inWard = db().prepare("SELECT 1 FROM ward_members WHERE ward_id = ? AND member_id = ?").get(org.ward_id, id);
    const r = inWard ? recipientById(id, orgId) : undefined;
    if (!r) return null;
    list = [r];
    label = r.display_name;
  } else {
    let audience: Audience | null = null;
    if (["everyone", "presidency", "teachers"].includes(m[3])) audience = m[3] as Audience;
    const g = m[3].match(/^group:(\d+)$/);
    const group = g ? getGroup(Number(g[1]), orgId) : undefined;
    if (group && canSendTo(group, user.id, "presidency")) audience = `group:${group.id}`;
    if (!audience) return null;
    list = audienceMembers(orgId, audience, { tz: getWard(org.ward_id)?.timezone });
    label = audience === "everyone" ? `Everyone in ${org.name}` : audience === "presidency" ? `The ${org.kind === "ward" ? "bishopric" : `${org.name} presidency`}` : audience === "teachers" ? "Upcoming teachers" : group!.name;
  }
  const people = list
    .filter((p) => p.id !== user.id)
    .map((p) => ({ id: p.id, name: p.display_name, phone: p.phone }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return { orgId, label, people };
}
