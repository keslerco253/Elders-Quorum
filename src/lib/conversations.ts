import { db } from "./db";
import { audienceMembers, notify, recipientById } from "./notify";
import { CALLING_LABELS, type Calling } from "./types";

// Each member can talk with the whole presidency (recipient_id NULL) and,
// privately, with any one presidency member (recipient_id = that person).
// A private thread is visible only to the member and that presidency member.

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
const ORDER: Calling[] = ["president", "first_counselor", "second_counselor", "secretary"];

/** Active presidency members, president first, for members choosing who to write to. */
export function presidencyContacts(wardId: number): PresidencyContact[] {
  const rows = db().prepare("SELECT id, display_name, calling FROM members WHERE ward_id = ? AND role = 'presidency' AND status = 'active' ORDER BY display_name").all(wardId) as PresidencyContact[];
  const rank = (c: Calling | null) => (c ? ORDER.indexOf(c) : ORDER.length);
  return rows.sort((a, b) => rank(a.calling) - rank(b.calling));
}

export function contactLabel(p: PresidencyContact) {
  return p.calling ? `${p.display_name} (${CALLING_LABELS[p.calling]})` : p.display_name;
}

function threadSql(t: Thread) {
  return t.private ? { sql: "recipient_id = ?", args: [t.withId] } : { sql: "recipient_id IS NULL", args: [] };
}

/** The quorum message a member most likely means when they text back: the newest one sent to them this past week. */
export function recentMessageFor(memberId: number): number | null {
  const r = db()
    .prepare(
      `SELECT m.id FROM messages m JOIN message_recipients mr ON mr.message_id = m.id
       WHERE mr.member_id = ? AND m.created_at > datetime('now', '-7 days') ORDER BY m.created_at DESC, m.id DESC LIMIT 1`,
    )
    .get(memberId) as { id: number } | undefined;
  return r?.id ?? null;
}

/**
 * Where a text reply belongs: if the newest thing the presidency sent this member
 * in the past week was private, the reply stays private to that person.
 */
export function threadForTextReply(memberId: number): Thread {
  const r = db()
    .prepare("SELECT recipient_id FROM member_messages WHERE member_id = ? AND direction = 'out' AND created_at > datetime('now', '-7 days') ORDER BY id DESC LIMIT 1")
    .get(memberId) as { recipient_id: number | null } | undefined;
  return r?.recipient_id ? { private: true, withId: r.recipient_id } : { private: false };
}

/** A presidency member in this ward who can receive private messages. */
function presidencyMember(wardId: number, id: number) {
  const ok = db().prepare("SELECT 1 FROM members WHERE id = ? AND ward_id = ? AND role = 'presidency' AND status = 'active'").get(id, wardId);
  return ok ? recipientById(id) : undefined;
}

/** Saves a member's message and lets the presidency (or just the one person) know. */
export async function receiveReply(member: { id: number; ward_id: number; display_name: string }, body: string, via: "app" | "text", messageId: number | null, thread: Thread = { private: false }) {
  const text = body.trim().slice(0, MAX_BODY);
  if (!text) return;
  const to = thread.private ? presidencyMember(member.ward_id, thread.withId) : undefined;
  // A private message to someone no longer in the presidency goes to the whole presidency instead.
  const recipientId = to ? to.id : null;
  // Only link messages this member actually received.
  const msg = messageId ? (db().prepare("SELECT 1 FROM message_recipients WHERE message_id = ? AND member_id = ?").get(messageId, member.id) ? messageId : null) : null;
  db().prepare("INSERT INTO member_messages (ward_id, member_id, direction, message_id, body, via, recipient_id) VALUES (?, ?, 'in', ?, ?, ?, ?)").run(member.ward_id, member.id, msg, text, via, recipientId);
  if (to) {
    // Private: the words stay in the app, not on a lock screen or in an inbox others may see.
    await notify([to], { title: `Private message from ${member.display_name}`, body: "Open the app to read it.", url: `/admin/replies/${member.id}?private=1` });
  } else {
    const preview = text.length > 120 ? text.slice(0, 117) + "…" : text;
    await notify(audienceMembers(member.ward_id, "presidency"), { title: `Reply from ${member.display_name}`, body: preview, url: `/admin/replies/${member.id}` });
  }
}

/** Sends a presidency member's answer to a member, in the whole-presidency thread or privately. */
export async function sendAnswer(author: { id: number; ward_id: number; display_name: string }, memberId: number, body: string, privately = false) {
  const text = body.trim().slice(0, MAX_BODY);
  const member = recipientById(memberId);
  if (!text || !member || member.ward_id !== author.ward_id) return false;
  db().prepare("INSERT INTO member_messages (ward_id, member_id, direction, author_id, body, recipient_id) VALUES (?, ?, 'out', ?, ?, ?)").run(author.ward_id, memberId, author.id, text, privately ? author.id : null);
  await notify(
    [member],
    privately
      ? { title: `Private message from ${author.display_name}`, body: "Open the app to read it.", url: "/messages" }
      : { title: "Message from the presidency", body: `${author.display_name}: ${text}`, url: "/messages" },
  );
  return true;
}

const ITEM_SQL = `SELECT c.id, c.direction, a.display_name AS author_name, c.recipient_id, r.display_name AS recipient_name, c.message_id, m.title AS message_title, c.body, c.via, c.read_at, c.created_at
  FROM member_messages c LEFT JOIN members a ON a.id = c.author_id LEFT JOIN members r ON r.id = c.recipient_id LEFT JOIN messages m ON m.id = c.message_id`;

/** Everything a member has sent or received (their own view). */
export function memberConversation(memberId: number): ConversationItem[] {
  return db().prepare(`${ITEM_SQL} WHERE c.member_id = ? ORDER BY c.created_at, c.id`).all(memberId) as ConversationItem[];
}

/** One thread, as a presidency member sees it. */
export function conversation(memberId: number, thread: Thread): ConversationItem[] {
  const t = threadSql(thread);
  return db().prepare(`${ITEM_SQL} WHERE c.member_id = ? AND c.${t.sql} ORDER BY c.created_at, c.id`).all(memberId, ...t.args) as ConversationItem[];
}

/** Quorum messages this member was sent, newest first. */
export function inbox(memberId: number, limit = 20): InboxMessage[] {
  return db()
    .prepare(
      `SELECT m.id, m.title, m.body, m.link, s.display_name AS sender_name, m.created_at
       FROM messages m JOIN message_recipients mr ON mr.message_id = m.id LEFT JOIN members s ON s.id = m.sender_id
       WHERE mr.member_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
    )
    .all(memberId, limit) as InboxMessage[];
}

/** Threads this presidency member may see (whole presidency, and private to them), most recent first. */
export function wardConversations(wardId: number, viewerId: number): ConversationSummary[] {
  return db()
    .prepare(
      `SELECT c.member_id, mem.display_name AS member_name, c.recipient_id, c.body AS last_body, c.direction AS last_direction, c.created_at AS last_at,
         (SELECT COUNT(*) FROM member_messages u WHERE u.member_id = c.member_id AND u.recipient_id IS c.recipient_id AND u.direction = 'in' AND u.read_at IS NULL) AS unread
       FROM member_messages c JOIN members mem ON mem.id = c.member_id
       WHERE c.ward_id = ? AND (c.recipient_id IS NULL OR c.recipient_id = ?)
         AND c.id = (SELECT MAX(id) FROM member_messages x WHERE x.member_id = c.member_id AND x.recipient_id IS c.recipient_id)
       ORDER BY c.created_at DESC, c.id DESC`,
    )
    .all(wardId, viewerId) as ConversationSummary[];
}

/** Unread messages this presidency member can see. */
export function unreadReplies(wardId: number, viewerId: number): number {
  return (
    db().prepare("SELECT COUNT(*) AS n FROM member_messages WHERE ward_id = ? AND direction = 'in' AND read_at IS NULL AND (recipient_id IS NULL OR recipient_id = ?)").get(wardId, viewerId) as {
      n: number;
    }
  ).n;
}

/** New answers from the presidency the member hasn't seen. */
export function unreadAnswers(memberId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM member_messages WHERE member_id = ? AND direction = 'out' AND read_at IS NULL").get(memberId) as { n: number }).n;
}

/** Marks the member's view read (all answers). */
export function markAnswersRead(memberId: number) {
  db().prepare("UPDATE member_messages SET read_at = datetime('now') WHERE member_id = ? AND direction = 'out' AND read_at IS NULL").run(memberId);
}

/** Marks one thread's incoming messages read for the presidency. */
export function markThreadRead(memberId: number, thread: Thread) {
  const t = threadSql(thread);
  db().prepare(`UPDATE member_messages SET read_at = datetime('now') WHERE member_id = ? AND direction = 'in' AND read_at IS NULL AND ${t.sql}`).run(memberId, ...t.args);
}

/** Counts a member's messages in the last hour, to stop runaway texting or posting. */
export function recentReplies(memberId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM member_messages WHERE member_id = ? AND direction = 'in' AND created_at > datetime('now', '-1 hour')").get(memberId) as { n: number }).n;
}
