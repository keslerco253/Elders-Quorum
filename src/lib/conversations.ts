import { db } from "./db";
import { audienceMembers, notify, recipientById } from "./notify";
import { callingLabel, CALLINGS, type Calling, type Org } from "./types";
import { getOrg } from "./orgs";

// In each organization, a member can talk with the whole presidency
// (recipient_id NULL) and, privately, with any one presidency member
// (recipient_id = that person). A private thread is visible only to the member
// and that presidency member. Conversations stay inside their organization.

export interface ConversationItem {
  id: number;
  direction: "in" | "out";
  author_name: string | null;
  recipient_id: number | null;
  recipient_name: string | null;
  message_id: number | null;
  message_title: string | null;
  body: string;
  via: "app" | "text";
  read_at: string | null;
  created_at: string;
}

export interface ConversationSummary {
  member_id: number;
  member_name: string;
  recipient_id: number | null;
  last_body: string;
  last_direction: "in" | "out";
  last_at: string;
  unread: number;
}

export interface InboxMessage {
  id: number;
  title: string;
  body: string;
  link: string;
  sender_name: string | null;
  created_at: string;
}

export interface PresidencyContact {
  id: number;
  display_name: string;
  calling: Calling | null;
}

/** Which conversation: the whole presidency, or private with one presidency member. */
export type Thread = { private: false } | { private: true; withId: number };

const MAX_BODY = 1000;
const ORDER: Calling[] = ["bishop", ...CALLINGS.group];

/** Active presidency (or bishopric) members, president first, for members choosing who to write to. */
export function presidencyContacts(orgId: number): PresidencyContact[] {
  const rows = db()
    .prepare("SELECT m.id, m.display_name, om.calling FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ? WHERE om.role = 'presidency' AND m.status = 'active' ORDER BY m.display_name")
    .all(orgId) as PresidencyContact[];
  const rank = (c: Calling | null) => (c && ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
  return rows.sort((a, b) => rank(a.calling) - rank(b.calling));
}

export function contactLabel(p: PresidencyContact, org: Pick<Org, "kind" | "name">) {
  return p.calling && ORDER.includes(p.calling) ? `${p.display_name} (${callingLabel(p.calling, org)})` : p.display_name;
}

function threadSql(t: Thread) {
  return t.private ? { sql: "recipient_id = ?", args: [t.withId] } : { sql: "recipient_id IS NULL", args: [] };
}

/** The message a member most likely means when they text back: the newest one the organization sent them this past week. */
export function recentMessageFor(memberId: number, orgId: number): number | null {
  const r = db()
    .prepare(
      `SELECT m.id FROM messages m JOIN message_recipients mr ON mr.message_id = m.id
       WHERE mr.member_id = ? AND m.org_id = ? AND m.created_at > datetime('now', '-7 days') ORDER BY m.created_at DESC, m.id DESC LIMIT 1`,
    )
    .get(memberId, orgId) as { id: number } | undefined;
  return r?.id ?? null;
}

/**
 * Where a text reply belongs: if the newest thing the presidency sent this member
 * in the past week was private, the reply stays private to that person.
 */
export function threadForTextReply(memberId: number, orgId: number): Thread {
  const r = db()
    .prepare("SELECT recipient_id FROM member_messages WHERE member_id = ? AND org_id = ? AND direction = 'out' AND created_at > datetime('now', '-7 days') ORDER BY id DESC LIMIT 1")
    .get(memberId, orgId) as { recipient_id: number | null } | undefined;
  return r?.recipient_id ? { private: true, withId: r.recipient_id } : { private: false };
}

/** A presidency member in this organization who can receive private messages. */
function presidencyMember(orgId: number, id: number) {
  const ok = db().prepare("SELECT 1 FROM org_members WHERE member_id = ? AND org_id = ? AND role = 'presidency'").get(id, orgId);
  return ok ? recipientById(id, orgId) : undefined;
}

/** Saves a member's message and lets the presidency (or just the one person) know. */
export async function receiveReply(member: { id: number; org_id: number; display_name: string }, body: string, via: "app" | "text", messageId: number | null, thread: Thread = { private: false }) {
  const text = body.trim().slice(0, MAX_BODY);
  if (!text) return;
  const to = thread.private ? presidencyMember(member.org_id, thread.withId) : undefined;
  // A private message to someone no longer in the presidency goes to the whole presidency instead.
  const recipientId = to ? to.id : null;
  // Only link messages this member actually received.
  const msg = messageId ? (db().prepare("SELECT 1 FROM message_recipients WHERE message_id = ? AND member_id = ?").get(messageId, member.id) ? messageId : null) : null;
  db().prepare("INSERT INTO member_messages (org_id, member_id, direction, message_id, body, via, recipient_id) VALUES (?, ?, 'in', ?, ?, ?, ?)").run(member.org_id, member.id, msg, text, via, recipientId);
  // Leaders read the whole message in the notification, text or email; answering is in the app.
  if (to) {
    await notify([to], {
      title: `Private message from ${member.display_name}`,
      body: text,
      url: `/admin/replies/${member.id}?private=1`,
      fullText: true,
      linkLabel: "Answer",
      replyTo: { memberId: member.id, private: true },
    });
  } else {
    await notify(audienceMembers(member.org_id, "presidency"), {
      title: `Reply from ${member.display_name}`,
      body: text,
      url: `/admin/replies/${member.id}`,
      fullText: true,
      linkLabel: "Answer",
      replyTo: { memberId: member.id, private: false },
    });
  }
}

/** Sends a presidency member's answer to a member, in the whole-presidency thread or privately. */
export async function sendAnswer(author: { id: number; org_id: number; display_name: string }, memberId: number, body: string, privately = false) {
  const text = body.trim().slice(0, MAX_BODY);
  const member = recipientById(memberId, author.org_id);
  const org = getOrg(author.org_id);
  if (!text || !member || !org || !db().prepare("SELECT 1 FROM ward_members WHERE ward_id = ? AND member_id = ?").get(org.ward_id, memberId)) return false;
  db().prepare("INSERT INTO member_messages (org_id, member_id, direction, author_id, body, recipient_id) VALUES (?, ?, 'out', ?, ?, ?)").run(author.org_id, memberId, author.id, text, privately ? author.id : null);
  await notify(
    [member],
    // A personal note (private or not): the notification shows who it's from; texts and emails are just the words, signed.
    { title: author.display_name, body: text, url: "/messages", personal: { from: author.display_name } },
  );
  return true;
}

const ITEM_SQL = `SELECT c.id, c.direction, a.display_name AS author_name, c.recipient_id, r.display_name AS recipient_name, c.message_id, m.title AS message_title, c.body, c.via, c.read_at, c.created_at
  FROM member_messages c LEFT JOIN members a ON a.id = c.author_id LEFT JOIN members r ON r.id = c.recipient_id LEFT JOIN messages m ON m.id = c.message_id`;

/** Everything a member has sent to or received from one organization (their own view). */
export function memberConversation(memberId: number, orgId: number): ConversationItem[] {
  return db().prepare(`${ITEM_SQL} WHERE c.member_id = ? AND c.org_id = ? ORDER BY c.created_at, c.id`).all(memberId, orgId) as ConversationItem[];
}

/** One thread, as a presidency member sees it. */
export function conversation(orgId: number, memberId: number, thread: Thread): ConversationItem[] {
  const t = threadSql(thread);
  return db().prepare(`${ITEM_SQL} WHERE c.org_id = ? AND c.member_id = ? AND c.${t.sql} ORDER BY c.created_at, c.id`).all(orgId, memberId, ...t.args) as ConversationItem[];
}

/** Messages one organization sent this member, newest first. */
export function inbox(memberId: number, orgId: number, limit = 20): InboxMessage[] {
  return db()
    .prepare(
      `SELECT m.id, m.title, m.body, m.link, s.display_name AS sender_name, m.created_at
       FROM messages m JOIN message_recipients mr ON mr.message_id = m.id LEFT JOIN members s ON s.id = m.sender_id
       WHERE mr.member_id = ? AND m.org_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
    )
    .all(memberId, orgId, limit) as InboxMessage[];
}

/** Threads this presidency member may see (whole presidency, and private to them), most recent first. */
export function wardConversations(orgId: number, viewerId: number): ConversationSummary[] {
  return db()
    .prepare(
      `SELECT c.member_id, mem.display_name AS member_name, c.recipient_id, c.body AS last_body, c.direction AS last_direction, c.created_at AS last_at,
         (SELECT COUNT(*) FROM member_messages u WHERE u.org_id = c.org_id AND u.member_id = c.member_id AND u.recipient_id IS c.recipient_id AND u.direction = 'in' AND u.read_at IS NULL) AS unread
       FROM member_messages c JOIN members mem ON mem.id = c.member_id
       WHERE c.org_id = ? AND (c.recipient_id IS NULL OR c.recipient_id = ?)
         AND c.id = (SELECT MAX(id) FROM member_messages x WHERE x.org_id = c.org_id AND x.member_id = c.member_id AND x.recipient_id IS c.recipient_id)
       ORDER BY c.created_at DESC, c.id DESC`,
    )
    .all(orgId, viewerId) as ConversationSummary[];
}

/** Unread messages this presidency member can see. */
export function unreadReplies(orgId: number, viewerId: number): number {
  return (
    db().prepare("SELECT COUNT(*) AS n FROM member_messages WHERE org_id = ? AND direction = 'in' AND read_at IS NULL AND (recipient_id IS NULL OR recipient_id = ?)").get(orgId, viewerId) as {
      n: number;
    }
  ).n;
}

/** New answers from leaders the member hasn't seen (in one organization, or all). */
export function unreadAnswers(memberId: number, orgId?: number): number {
  return (
    db()
      .prepare(`SELECT COUNT(*) AS n FROM member_messages WHERE member_id = ? AND direction = 'out' AND read_at IS NULL ${orgId ? "AND org_id = ?" : ""}`)
      .get(...(orgId ? [memberId, orgId] : [memberId])) as { n: number }
  ).n;
}

/** Organizations with answers the member hasn't seen. */
export function orgsWithUnreadAnswers(memberId: number): number[] {
  return (db().prepare("SELECT DISTINCT org_id FROM member_messages WHERE member_id = ? AND direction = 'out' AND read_at IS NULL").all(memberId) as { org_id: number }[]).map((r) => r.org_id);
}

/** Marks the member's view of one organization read (all its answers). */
export function markAnswersRead(memberId: number, orgId: number) {
  db().prepare("UPDATE member_messages SET read_at = datetime('now') WHERE member_id = ? AND org_id = ? AND direction = 'out' AND read_at IS NULL").run(memberId, orgId);
}

/** Marks one thread's incoming messages read for the presidency. */
export function markThreadRead(orgId: number, memberId: number, thread: Thread) {
  const t = threadSql(thread);
  db().prepare(`UPDATE member_messages SET read_at = datetime('now') WHERE org_id = ? AND member_id = ? AND direction = 'in' AND read_at IS NULL AND ${t.sql}`).run(orgId, memberId, ...t.args);
}

/** Counts a member's messages in the last hour, to stop runaway texting or posting. */
export function recentReplies(memberId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM member_messages WHERE member_id = ? AND direction = 'in' AND created_at > datetime('now', '-1 hour')").get(memberId) as { n: number }).n;
}
