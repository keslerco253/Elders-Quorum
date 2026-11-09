import { DateTime } from "luxon";
import { appUrl } from "./config";
import { db } from "./db";
import { composeChoices } from "./compose";
import { audienceMembers, type Audience } from "./notify";
import { getOrg, getWard, orgRoster, wardOrg } from "./orgs";
import { nameParts } from "./member-list";

export type PhonePerson = { id: number; name: string; first: string; phone: string | null };
export type PhoneChoice = { value: string; label: string; ids: number[] };
export type PhoneLink = { label: string; url: string };

/**
 * Everything "Text from my phone" needs for one organization the leader leads, where
 * the ward has it turned on: who it can go to (everyone, the presidency, teachers,
 * the organization's message groups, one person, or people picked from the whole
 * list), everyone's numbers, and links to add. `to` is the choice from New message
 * ("aud:<org>:everyone", "person:<org>:<id>", "pick:<org>"). Null when it can't be used.
 */
export function phoneTextData(user: { id: number }, to: string) {
  const m = to.match(/^(aud|person|pick):(\d+)(?::(.+))?$/);
  if (!m) return null;
  const orgId = Number(m[2]);
  const org = getOrg(orgId);
  const ward = org ? getWard(org.ward_id) : undefined;
  if (!org || !ward?.phone_texting) return null;
  const mine = composeChoices(user.id).orgs.find((o) => o.orgId === orgId);
  if (!mine) return null;
  const people = new Map<number, PhonePerson>();
  const add = (p: { id: number; display_name: string; phone?: string | null }) => {
    if (p.id === user.id || people.has(p.id)) return;
    const phone = p.phone ?? (db().prepare("SELECT phone FROM members WHERE id = ?").get(p.id) as { phone: string | null } | undefined)?.phone ?? null;
    people.set(p.id, { id: p.id, name: p.display_name, first: nameParts(p.display_name).first, phone });
  };
  for (const p of orgRoster(orgId)) add(p);
  const choices: PhoneChoice[] = mine.audiences.map((a) => {
    const list = audienceMembers(orgId, a.value.split(":").slice(2).join(":") as Audience, { tz: ward.timezone });
    list.forEach(add);
    return { value: a.value, label: a.label, ids: list.map((p) => p.id).filter((id) => id !== user.id) };
  });
  let initial = to;
  if (m[1] === "person") {
    const p = people.get(Number(m[3]));
    if (!p) return null;
    choices.push({ value: to, label: p.name, ids: [p.id] });
  } else if (m[1] === "aud" && !choices.some((c) => c.value === to)) initial = choices[0]?.value ?? "";
  if (m[1] === "pick") initial = `pick:${orgId}`;
  const sorted = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return { orgId, initial, choices, people: sorted, links: phoneLinks(orgId, ward.id, ward.timezone) };
}

/** Links to add at the end of the text: the next lesson (in the app, and the talk itself), the calendar, coming events and service sign-ups. */
function phoneLinks(orgId: number, wardId: number, tz: string): PhoneLink[] {
  const base = appUrl();
  const today = DateTime.now().setZone(tz).toISODate()!;
  const d = db();
  const out: PhoneLink[] = [];
  const lesson = d.prepare("SELECT id, date, title, url FROM lessons WHERE org_id = ? AND date >= ? ORDER BY date LIMIT 1").get(orgId, today) as
    | { id: number; date: string; title: string; url: string }
    | undefined;
  if (lesson) {
    const when = DateTime.fromISO(lesson.date).toFormat("LLL d");
    out.push({ label: `Lesson ${when}${lesson.title ? `: ${lesson.title}` : ""} (in the app)`, url: `${base}/lessons/${lesson.id}` });
    if (/^https:\/\//i.test(lesson.url ?? "")) out.push({ label: `The talk itself (Gospel Library, no sign-in)`, url: `${base}/l/${lesson.id}` });
  }
  out.push({ label: "Calendar", url: `${base}/calendar` });
  const events = d
    .prepare("SELECT id, title, starts_at FROM events WHERE org_id IN (?, ?) AND presidency_only = 0 AND ends_at >= ? ORDER BY starts_at LIMIT 15")
    .all(orgId, wardOrg(wardId).id, new Date().toISOString()) as { id: number; title: string; starts_at: string }[];
  for (const e of events) out.push({ label: `Event: ${e.title} (${DateTime.fromISO(e.starts_at, { zone: "utc" }).setZone(tz).toFormat("LLL d")})`, url: `${base}/calendar/${e.id}` });
  const signups = d.prepare("SELECT id, title, date FROM signups WHERE org_id = ? AND closed = 0 AND (date IS NULL OR date >= ?) ORDER BY date IS NULL, date LIMIT 10").all(orgId, today) as {
    id: number;
    title: string;
    date: string | null;
  }[];
  for (const s of signups) out.push({ label: `Service: ${s.title}${s.date ? ` (${DateTime.fromISO(s.date).toFormat("LLL d")})` : ""}`, url: `${base}/signups/${s.id}` });
  return out;
}
