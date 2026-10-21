import { db } from "./db";
import { audienceMembers, notify, recipientById, type Recipient } from "./notify";
import { pushToMember } from "./push";
import { getOrg, getWard, leadersPhrase, orgLabel, wardOrg } from "./orgs";
import type { CurrentUser } from "./types";

// Making sure a member's message always reaches someone. A message to an
// organization nobody can receive (turned off, or no presidency) goes to the
// ward's backup person, who passes it on; any leader can forward a message that
// reached the wrong place; and a member who texted gets an app notification
// saying where their message went.

/** The presidency who'd get a member's message to this organization (never the sender). */
export function orgReceivers(orgId: number, senderId: number): Recipient[] {
  const org = getOrg(orgId);
  if (!org?.active) return [];
  return audienceMembers(orgId, "presidency").filter((r) => r.id !== senderId);
}

/** The ward's backup person, or (if none is set) the bishopric. */
export function backupReceivers(wardId: number, senderId: number): Recipient[] {
  const ward = getWard(wardId);
  const top = wardOrg(wardId);
  const backup = ward?.reply_backup_id && db().prepare("SELECT 1 FROM ward_members WHERE ward_id = ? AND member_id = ?").get(wardId, ward.reply_backup_id) ? recipientById(ward.reply_backup_id, top.id) : undefined;
  if (backup && backup.id !== senderId) return [backup];
  return audienceMembers(top.id, "presidency").filter((r) => r.id !== senderId);
}

/** Who can see and pass on messages waiting for a home: the backup person and the bishopric. */
export const handlesBackup = (user: CurrentUser) => user.wardLeader || user.ward.reply_backup_id === user.id;

/** Lets someone who texted know where their message went: an app notification only, never a text. */
export async function confirmToSender(memberId: number, where: string) {
  await pushToMember(memberId, { title: "Message received", body: `Your message went to ${where}.`, url: "/messages", tag: "message-received" });
}

export interface WaitingMessage {
  id: number;
  member_id: number;
  member_name: string;
  org_id: number;
  body: string;
  via: "app" | "text";
  created_at: string;
}

/** Members' messages in this ward that no organization could receive yet. */
export function messagesNeedingHome(wardId: number): WaitingMessage[] {
  return db()
    .prepare(
      `SELECT c.id, c.member_id, m.display_name AS member_name, c.org_id, c.body, c.via, c.created_at
       FROM member_messages c JOIN members m ON m.id = c.member_id JOIN orgs o ON o.id = c.org_id
       WHERE o.ward_id = ? AND c.needs_home = 1 ORDER BY c.id`,
    )
    .all(wardId) as WaitingMessage[];
}

/** Where a message can be forwarded: each organization's presidency, or one leader in it. */
export function forwardTargets(wardId: number): { value: string; label: string }[] {
  const orgs = db().prepare("SELECT id FROM orgs WHERE ward_id = ? AND active = 1 ORDER BY kind = 'group', name COLLATE NOCASE").all(wardId) as { id: number }[];
  return orgs.flatMap(({ id }) => {
    const leaders = audienceMembers(id, "presidency");
    if (!leaders.length) return [];
    const org = getOrg(id)!;
    const name = orgLabel(org);
    return [{ value: `org:${id}`, label: `${name}: the whole ${org.kind === "ward" ? "bishopric" : "presidency"}` }, ...leaders.map((l) => ({ value: `leader:${id}:${l.id}`, label: `${name}: just ${l.display_name}` }))];
  });
}

/**
 * Forwards a member's message to another organization's presidency or one of its
 * leaders: it shows in their Messages with a note, they're notified, and the
 * member's next texted reply goes there. Returns where it went, or null.
 */
export async function forwardMessage(user: CurrentUser, messageId: number, target: string): Promise<string | null> {
  const d = db();
  const msg = d
    .prepare("SELECT c.*, o.ward_id FROM member_messages c JOIN orgs o ON o.id = c.org_id WHERE c.id = ? AND c.direction = 'in'")
    .get(messageId) as { id: number; org_id: number; member_id: number; body: string; via: "app" | "text"; ward_id: number; needs_home: number } | undefined;
  if (!msg || msg.ward_id !== user.ward_id) return null;
  // Its organization's leaders, the backup person, or the bishopric.
  const leadsIt = !!d.prepare("SELECT 1 FROM org_members WHERE org_id = ? AND member_id = ? AND role = 'presidency'").get(msg.org_id, user.id);
  if (!leadsIt && !handlesBackup(user)) return null;
  const m = target.match(/^(org|leader):(\d+)(?::(\d+))?$/);
  if (!m) return null;
  const toOrg = getOrg(Number(m[2]));
  if (!toOrg?.active || toOrg.ward_id !== msg.ward_id) return null;
  const leader = m[1] === "leader" ? audienceMembers(toOrg.id, "presidency").find((r) => r.id === Number(m[3])) : undefined;
  if (m[1] === "leader" && !leader) return null;
  const receivers = leader ? [leader] : audienceMembers(toOrg.id, "presidency");
  if (!receivers.length) return null;
  const member = d.prepare("SELECT display_name FROM members WHERE id = ?").get(msg.member_id) as { display_name: string };
  const where = leader ? `${leader.display_name} (${orgLabel(toOrg)})` : leadersPhrase(toOrg);
  d.transaction(() => {
    d.prepare("INSERT INTO member_messages (org_id, member_id, direction, body, via, recipient_id, note) VALUES (?, ?, 'in', ?, ?, ?, ?)").run(
      toOrg.id,
      msg.member_id,
      msg.body,
      msg.via,
      leader?.id ?? null,
      `Forwarded by ${user.display_name} from ${orgLabel(getOrg(msg.org_id)!)}`,
    );
    d.prepare("UPDATE member_messages SET needs_home = 0, note = ? WHERE id = ?").run(`Forwarded to ${where} by ${user.display_name}`, msg.id);
    // Their next texted reply goes to whoever has it now.
    d.prepare("UPDATE members SET last_text_org_id = ?, text_reply_member_id = NULL, text_as_member = 0 WHERE id = ?").run(toOrg.id, msg.member_id);
  })();
  await notify(receivers, {
    title: `Forwarded: message from ${member.display_name}`,
    textTitle: `${member.display_name} (forwarded by ${user.display_name})`,
    body: msg.body,
    url: `/admin/replies/${msg.member_id}${leader ? "?private=1" : ""}#end`,
    fullText: true,
    linkLabel: "Answer",
    replyTo: { memberId: msg.member_id, private: !!leader },
    tag: `conv-${toOrg.id}-${msg.member_id}${leader ? "-p" : ""}`,
  });
  return where;
}
