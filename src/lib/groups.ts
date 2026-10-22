import { db } from "./db";
import { audienceLabel, audienceMembers, notify, type Audience } from "./notify";
import type { CurrentUser, Org, Role } from "./types";
import { leadersWord } from "./types";
import { orgTakesMessages } from "./message-routing";

export interface Group {
  id: number;
  org_id: number;
  name: string;
  send_presidency: number;
  send_admins: number;
  send_members: number;
}

const COLUMNS = "g.id, g.org_id, g.name, g.send_presidency, g.send_admins, g.send_members";

export function orgGroups(orgId: number): (Group & { n: number })[] {
  return db()
    .prepare(`SELECT ${COLUMNS}, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS n FROM groups g WHERE g.org_id = ? ORDER BY g.name COLLATE NOCASE`)
    .all(orgId) as (Group & { n: number })[];
}

export function getGroup(id: number, orgId: number): Group | undefined {
  return db().prepare(`SELECT ${COLUMNS} FROM groups g WHERE g.id = ? AND g.org_id = ?`).get(id, orgId) as Group | undefined;
}

export function inGroup(groupId: number, memberId: number): boolean {
  return !!db().prepare("SELECT 1 FROM group_members WHERE group_id = ? AND member_id = ?").get(groupId, memberId);
}

/** Whether someone (with this role in the group's organization) can see the group and send to it. */
export function canSendTo(g: Group, memberId: number, role: Role): boolean {
  if (role === "presidency" && g.send_presidency) return true;
  return !!g.send_members && inGroup(g.id, memberId);
}

/** The leadership can always change a group. */
export function canManage(_g: Group, role: Role): boolean {
  return role === "presidency";
}

/** Groups this person can send to in their current organization. */
export function sendableGroups(user: Pick<CurrentUser, "id" | "org_id" | "role">): Group[] {
  return orgGroups(user.org_id).filter((g) => canSendTo(g, user.id, user.role));
}

/** "The presidency and people in the group" */
export function sendersText(g: Group, org: Pick<Org, "kind">): string {
  const who = [g.send_presidency ? `the ${leadersWord(org)}` : "", g.send_members ? "people in the group" : ""].filter(Boolean);
  if (who.length === 0) return `Only the ${leadersWord(org)} can change it; no one can send to it yet`;
  const text = who.length === 1 ? who[0] : `${who.slice(0, -1).join(", ")} and ${who[who.length - 1]}`;
  return text[0].toUpperCase() + text.slice(1);
}

/** Group messages a member (not a leader) sent in the last day, to keep it reasonable. */
export function memberGroupSendsToday(memberId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM messages WHERE sender_id = ? AND audience LIKE 'group:%' AND created_at > datetime('now', '-1 day')").get(memberId) as { n: number }).n;
}

/**
 * Saves a message (so it shows under Messages and can be answered) and sends
 * it. A personal one is signed with the sender's name instead of a title.
 */
export async function sendToAudience(opts: {
  orgId: number;
  senderId: number;
  audience: Audience;
  title: string;
  body: string;
  link?: string;
  tz: string;
  personal?: { from: string };
  /** An uploaded flyer (PDF or picture) shown with the message and emailed with it. */
  flyer?: { file: string; name: string };
}) {
  const d = db();
  const recipients = audienceMembers(opts.orgId, opts.audience, { tz: opts.tz }).filter((r) => !opts.personal || r.id !== opts.senderId);
  const messageId = d.transaction(() => {
    const id = Number(
      d
        .prepare("INSERT INTO messages (org_id, sender_id, audience, audience_label, title, body, link, flyer_file, flyer_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(opts.orgId, opts.senderId, opts.audience, audienceLabel(opts.orgId, opts.audience), opts.title, opts.body, opts.link ?? "/", opts.flyer?.file ?? null, opts.flyer?.name ?? null).lastInsertRowid,
    );
    const ins = d.prepare("INSERT OR IGNORE INTO message_recipients (message_id, member_id) VALUES (?, ?)");
    for (const r of recipients) ins.run(id, r.id);
    return id;
  })();
  const result = await notify(recipients, {
    title: opts.title,
    body: opts.body,
    url: `/messages/a/${messageId}`,
    message: true,
    ...(opts.flyer ? { attachment: opts.flyer, textBody: `${opts.body} (Flyer attached; open the link to see it.)` } : {}),
    // Replying to the email itself wouldn't reach the leaders (it goes to the app's mailbox).
    // When they don't take messages through the app, it's for information only.
    ...(opts.personal || orgTakesMessagesFromMembers(opts.orgId)
      ? { linkLabel: "Reply in the app", emailNote: "To reply, use the button below or text back. Replies to this email aren't seen by your leaders." }
      : { linkLabel: "Open in the app", emailNote: "This message is for your information. Replies to it aren't received." }),
    ...(opts.personal ? { personal: opts.personal } : {}),
  });
  d.prepare("UPDATE messages SET push_count = ?, email_count = ?, text_count = ? WHERE id = ?").run(result.push, result.email, result.text, messageId);
  return { ...result, count: recipients.length, messageId };
}

/** Whether members can write back to this organization's leaders (for the wording of its messages). */
const orgTakesMessagesFromMembers = (orgId: number) => orgTakesMessages(orgId, 0);
