import { db } from "@/lib/db";
import { myOrgs, orgLabel } from "@/lib/orgs";
import type { ConversationItem } from "@/lib/conversations";
import type { Org } from "@/lib/types";

/** A member's conversation with one organization's leaders: the whole presidency (withId null) or one of them privately. */
export interface MemberThreadRow {
  kind: "thread";
  org_id: number;
  with_id: number | null;
  with_name: string | null;
  last_body: string;
  last_direction: "in" | "out";
  last_author_name: string | null;
  last_at: string;
  unread: number;
}

/** A message an organization sent this member (to everyone, a group, ...). */
export interface AnnouncementRow {
  kind: "announcement";
  id: number;
  org_id: number;
  title: string;
  body: string;
  link: string;
  sender_name: string | null;
  last_at: string;
  unread: number;
  flyer_file: string | null;
  flyer_name: string | null;
}

export type MemberInboxRow = (MemberThreadRow | AnnouncementRow) & { org_label: string; org_kind: Org["kind"] };

/** Labels for every organization these rows came from ("Elders Quorum", the ward's name, ...). */
function orgInfo(memberId: number, ids: number[]) {
  const mine = new Map(myOrgs(memberId).map((o) => [o.id, { label: o.label, kind: o.kind }]));
  const out = new Map<number, { label: string; kind: Org["kind"] }>();
  for (const id of new Set(ids)) {
    const o = mine.get(id);
    if (o) out.set(id, o);
    else {
      const row = db().prepare("SELECT * FROM orgs WHERE id = ?").get(id) as Org | undefined;
      out.set(id, row ? { label: orgLabel(row), kind: row.kind } : { label: "Organization", kind: "group" });
    }
  }
  return out;
}

/** Everything in a member's inbox, across all their organizations, newest first: one row per conversation and per announcement. */
export function memberInbox(memberId: number, opts: { unreadOnly?: boolean } = {}): MemberInboxRow[] {
  const threads = db()
    .prepare(
      `SELECT 'thread' AS kind, c.org_id, c.recipient_id AS with_id, r.display_name AS with_name, c.body AS last_body, c.direction AS last_direction,
         a.display_name AS last_author_name, c.created_at AS last_at,
         (SELECT COUNT(*) FROM member_messages u WHERE u.member_id = c.member_id AND u.org_id = c.org_id AND u.recipient_id IS c.recipient_id AND u.direction = 'out' AND u.read_at IS NULL) AS unread
       FROM member_messages c LEFT JOIN members r ON r.id = c.recipient_id LEFT JOIN members a ON a.id = c.author_id
       WHERE c.member_id = ? AND c.id = (SELECT MAX(id) FROM member_messages x WHERE x.member_id = c.member_id AND x.org_id = c.org_id AND x.recipient_id IS c.recipient_id)`,
    )
    .all(memberId) as MemberThreadRow[];
  const announcements = db()
    .prepare(
      `SELECT 'announcement' AS kind, m.id, m.org_id, m.title, m.body, m.link, m.flyer_file, m.flyer_name, s.display_name AS sender_name, m.created_at AS last_at, (mr.read_at IS NULL) AS unread
       FROM messages m JOIN message_recipients mr ON mr.message_id = m.id LEFT JOIN members s ON s.id = m.sender_id
       WHERE mr.member_id = ? AND (m.sender_id IS NULL OR m.sender_id <> ?) ORDER BY m.created_at DESC, m.id DESC LIMIT 60`,
    )
    .all(memberId, memberId) as AnnouncementRow[];
  const rows = [...threads, ...announcements].filter((r) => !opts.unreadOnly || r.unread > 0);
  const info = orgInfo(
    memberId,
    rows.map((r) => r.org_id),
  );
  return rows
    .map((r) => ({ ...r, org_label: info.get(r.org_id)!.label, org_kind: info.get(r.org_id)!.kind }))
    .sort((a, b) => (a.last_at < b.last_at ? 1 : a.last_at > b.last_at ? -1 : 0));
}

/** Unread announcements, for the Messages badge. */
export function unreadAnnouncements(memberId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM message_recipients mr JOIN messages m ON m.id = mr.message_id WHERE mr.member_id = ? AND mr.read_at IS NULL AND (m.sender_id IS NULL OR m.sender_id <> ?)").get(memberId, memberId) as { n: number }).n;
}

export interface Announcement {
  id: number;
  org_id: number;
  title: string;
  body: string;
  link: string;
  audience_label: string;
  sender_id: number | null;
  sender_name: string | null;
  created_at: string;
  flyer_file: string | null;
  flyer_name: string | null;
}

/** One announcement, if this member received (or sent) it. Opening it marks it read. */
export function openAnnouncement(memberId: number, id: number): Announcement | undefined {
  const m = db()
    .prepare(
      `SELECT m.id, m.org_id, m.title, m.body, m.link, m.audience_label, m.flyer_file, m.flyer_name, m.sender_id, s.display_name AS sender_name, m.created_at
       FROM messages m LEFT JOIN message_recipients mr ON mr.message_id = m.id AND mr.member_id = ? LEFT JOIN members s ON s.id = m.sender_id
       WHERE m.id = ? AND (mr.member_id IS NOT NULL OR m.sender_id = ?)`,
    )
    .get(memberId, id, memberId) as Announcement | undefined;
  if (m) db().prepare("UPDATE message_recipients SET read_at = datetime('now') WHERE message_id = ? AND member_id = ? AND read_at IS NULL").run(id, memberId);
  return m;
}

const ITEM_SQL = `SELECT c.id, c.direction, a.display_name AS author_name, c.recipient_id, r.display_name AS recipient_name, c.message_id, m.title AS message_title, c.body, c.via, c.read_at, c.created_at
  FROM member_messages c LEFT JOIN members a ON a.id = c.author_id LEFT JOIN members r ON r.id = c.recipient_id LEFT JOIN messages m ON m.id = c.message_id`;

/** One of the member's conversations, oldest first; opening it marks the leaders' answers read. */
export function openMemberThread(memberId: number, orgId: number, withId: number | null): ConversationItem[] {
  const where = withId ? "c.recipient_id = ?" : "c.recipient_id IS NULL";
  const args = withId ? [withId] : [];
  db()
    .prepare(`UPDATE member_messages SET read_at = datetime('now') WHERE member_id = ? AND org_id = ? AND direction = 'out' AND read_at IS NULL AND ${where.replace("c.", "")}`)
    .run(memberId, orgId, ...args);
  return db().prepare(`${ITEM_SQL} WHERE c.member_id = ? AND c.org_id = ? AND ${where} ORDER BY c.created_at, c.id`).all(memberId, orgId, ...args) as ConversationItem[];
}

export interface SentRow {
  kind: "thread" | "group";
  key: string;
  org_id: number;
  org_label: string;
  to: string;
  body: string;
  created_at: string;
  /** For conversations: when a leader read it. */
  read_at: string | null;
  href: string;
}

/** What a member has written: to their leaders, and to message groups. */
export function memberSent(memberId: number, limit = 50): SentRow[] {
  const mine = db()
    .prepare(
      `SELECT c.id, c.org_id, c.recipient_id, r.display_name AS recipient_name, c.body, c.created_at, c.read_at FROM member_messages c LEFT JOIN members r ON r.id = c.recipient_id
       WHERE c.member_id = ? AND c.direction = 'in' ORDER BY c.id DESC LIMIT ?`,
    )
    .all(memberId, limit) as { id: number; org_id: number; recipient_id: number | null; recipient_name: string | null; body: string; created_at: string; read_at: string | null }[];
  const groups = db()
    .prepare("SELECT id, org_id, audience_label, body, created_at FROM messages WHERE sender_id = ? AND audience LIKE 'group:%' ORDER BY id DESC LIMIT ?")
    .all(memberId, limit) as { id: number; org_id: number; audience_label: string; body: string; created_at: string }[];
  const info = orgInfo(memberId, [...mine, ...groups].map((r) => r.org_id));
  const rows: SentRow[] = [
    ...mine.map((c) => {
      const o = info.get(c.org_id)!;
      return {
        kind: "thread" as const,
        key: `t${c.id}`,
        org_id: c.org_id,
        org_label: o.label,
        to: c.recipient_id ? `${c.recipient_name} (private)` : `the ${o.kind === "ward" ? "bishopric" : "presidency"}`,
        body: c.body,
        created_at: c.created_at,
        read_at: c.read_at,
        href: `/messages/thread/${c.recipient_id ?? "all"}?org=${c.org_id}#end`,
      };
    }),
    ...groups.map((g) => ({
      kind: "group" as const,
      key: `g${g.id}`,
      org_id: g.org_id,
      org_label: info.get(g.org_id)!.label,
      to: g.audience_label,
      body: g.body,
      created_at: g.created_at,
      read_at: null,
      href: `/messages/a/${g.id}`,
    })),
  ];
  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
}
