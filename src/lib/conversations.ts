import { db } from "./db";
import { audienceMembers, notify, recipientById } from "./notify";

// Each member has one conversation with the presidency: their replies to quorum
// messages (in the app or by text) and the presidency's answers. Presidency only.

export interface ConversationItem {
  id: number;
  direction: "in" | "out";
  author_name: string | null;
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

const MAX_BODY = 1000;

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

/** Saves a member's reply and lets the presidency know. */
export async function receiveReply(member: { id: number; ward_id: number; display_name: string }, body: string, via: "app" | "text", messageId: number | null) {
  const text = body.trim().slice(0, MAX_BODY);
  if (!text) return;
  // Only link messages this member actually received.
  const msg = messageId ? (db().prepare("SELECT 1 FROM message_recipients WHERE message_id = ? AND member_id = ?").get(messageId, member.id) ? messageId : null) : null;
  db().prepare("INSERT INTO member_messages (ward_id, member_id, direction, message_id, body, via) VALUES (?, ?, 'in', ?, ?, ?)").run(member.ward_id, member.id, msg, text, via);
  const preview = text.length > 120 ? text.slice(0, 117) + "…" : text;
  await notify(audienceMembers(member.ward_id, "presidency"), {
    title: `Reply from ${member.display_name}`,
    body: preview,
    url: `/admin/replies/${member.id}`,
  });
}

/** Sends the presidency's answer to a member by push, or by their chosen text/email. */
export async function sendAnswer(author: { id: number; ward_id: number; display_name: string }, memberId: number, body: string) {
  const text = body.trim().slice(0, MAX_BODY);
  const member = recipientById(memberId);
  if (!text || !member || member.ward_id !== author.ward_id) return false;
  db().prepare("INSERT INTO member_messages (ward_id, member_id, direction, author_id, body) VALUES (?, ?, 'out', ?, ?)").run(author.ward_id, memberId, author.id, text);
  await notify([member], { title: "Message from the presidency", body: `${author.display_name}: ${text}`, url: "/messages" });
  return true;
}

export function conversation(memberId: number): ConversationItem[] {
  return db()
    .prepare(
      `SELECT c.id, c.direction, a.display_name AS author_name, c.message_id, m.title AS message_title, c.body, c.via, c.read_at, c.created_at
       FROM member_messages c LEFT JOIN members a ON a.id = c.author_id LEFT JOIN messages m ON m.id = c.message_id
       WHERE c.member_id = ? ORDER BY c.created_at, c.id`,
    )
    .all(memberId) as ConversationItem[];
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

/** Everyone who has written to the presidency, most recent first. */
export function wardConversations(wardId: number): ConversationSummary[] {
  return db()
    .prepare(
      `SELECT c.member_id, mem.display_name AS member_name, c.body AS last_body, c.direction AS last_direction, c.created_at AS last_at,
         (SELECT COUNT(*) FROM member_messages u WHERE u.member_id = c.member_id AND u.direction = 'in' AND u.read_at IS NULL) AS unread
       FROM member_messages c JOIN members mem ON mem.id = c.member_id
       WHERE c.ward_id = ? AND c.id = (SELECT MAX(id) FROM member_messages x WHERE x.member_id = c.member_id)
       ORDER BY c.created_at DESC, c.id DESC`,
    )
    .all(wardId) as ConversationSummary[];
}

export function unreadReplies(wardId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM member_messages WHERE ward_id = ? AND direction = 'in' AND read_at IS NULL").get(wardId) as { n: number }).n;
}

/** New answers from the presidency the member hasn't seen. */
export function unreadAnswers(memberId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM member_messages WHERE member_id = ? AND direction = 'out' AND read_at IS NULL").get(memberId) as { n: number }).n;
}

export function markRead(memberId: number, direction: "in" | "out") {
  db().prepare("UPDATE member_messages SET read_at = datetime('now') WHERE member_id = ? AND direction = ? AND read_at IS NULL").run(memberId, direction);
}

/** Counts a reply from this member in the last hour, to stop runaway texting or posting. */
export function recentReplies(memberId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM member_messages WHERE member_id = ? AND direction = 'in' AND created_at > datetime('now', '-1 hour')").get(memberId) as { n: number }).n;
}
