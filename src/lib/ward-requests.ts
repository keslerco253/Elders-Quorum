import { db } from "./db";
import { createLoginToken, findMemberByContact } from "./auth-core";
import { sendLoginCode } from "./login-code";
import { createWard } from "./orgs";
import { emailHtml, sendMail } from "./mail";
import { notify, recipientById } from "./notify";
import { appUrl } from "./config";
import { homeOf } from "./orgs";
import { formatPhone } from "./contact";
import { isCalling, type Calling, type Member } from "./types";

// Starting a new ward is a request: the site owner checks it's real, then approves it.

export interface WardRequest {
  id: number;
  name: string;
  contact: string;
  contact_kind: "email" | "phone";
  ward_name: string;
  stake: string;
  calling: string | null;
  timezone: string;
  note: string;
  member_id: number | null;
  status: "pending" | "approved" | "declined";
  ward_id: number | null;
  created_at: string;
  decided_at: string | null;
}

export function pendingWardRequests(): WardRequest[] {
  return db().prepare("SELECT * FROM ward_requests WHERE status = 'pending' ORDER BY id").all() as WardRequest[];
}

export function recentDecidedRequests(limit = 10): WardRequest[] {
  return db().prepare("SELECT * FROM ward_requests WHERE status <> 'pending' ORDER BY decided_at DESC LIMIT ?").all(limit) as WardRequest[];
}

const show = (r: Pick<WardRequest, "contact" | "contact_kind">) => (r.contact_kind === "phone" ? formatPhone(r.contact) : r.contact);

/** Saves the request and tells the site owner(s). Nothing is created until it's approved. */
export async function requestWard(r: Omit<WardRequest, "id" | "status" | "ward_id" | "created_at" | "decided_at">): Promise<number> {
  const id = Number(
    db()
      .prepare("INSERT INTO ward_requests (name, contact, contact_kind, ward_name, stake, calling, timezone, note, member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(r.name, r.contact, r.contact_kind, r.ward_name, r.stake, r.calling, r.timezone, r.note, r.member_id).lastInsertRowid,
  );
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const owners = db().prepare("SELECT id FROM members WHERE status = 'active' AND (is_site_owner = 1 OR lower(email) = ?)").all(owner) as { id: number }[];
  const recipients = owners.flatMap((o) => {
    const home = homeOf(o.id);
    const rec = home.orgId ? recipientById(o.id, home.orgId) : undefined;
    return rec ? [rec] : [];
  });
  await notify(recipients, {
    title: "New ward request",
    body: `${r.name} (${show(r)}) asked to start ${r.ward_name}${r.stake ? `, ${r.stake}` : ""}. Check it's real, then approve or decline it.`,
    url: "/site#ward-requests",
  });
  return id;
}

/** Approves a request: creates the ward (led by the requester) and sends them a sign-in link. */
export async function approveWardRequest(id: number): Promise<WardRequest | null> {
  const d = db();
  const r = d.prepare("SELECT * FROM ward_requests WHERE id = ? AND status = 'pending'").get(id) as WardRequest | undefined;
  if (!r) return null;
  const existing = (r.member_id ? (d.prepare("SELECT * FROM members WHERE id = ?").get(r.member_id) as Member | undefined) : undefined) ?? findMemberByContact(r.contact);
  const memberId =
    existing?.id ??
    Number(
      d
        .prepare(`INSERT INTO members (name, display_name, ${r.contact_kind}, contact_pref, status, source, welcomed_at) VALUES (?, ?, ?, ?, 'active', 'request', datetime('now'))`)
        .run(r.name, r.name, r.contact, r.contact_kind === "phone" ? "text" : "email").lastInsertRowid,
    );
  // They agreed to texts on the request form.
  if (!existing && r.contact_kind === "phone") d.prepare("UPDATE members SET sms_consent_at = datetime('now') WHERE id = ?").run(memberId);
  const ward = createWard({ name: r.ward_name, timezone: r.timezone, creatorId: memberId, calling: isCalling(r.calling) ? (r.calling as Calling) : null });
  d.prepare("UPDATE ward_requests SET status = 'approved', ward_id = ?, member_id = ?, decided_at = datetime('now') WHERE id = ?").run(ward.id, memberId, id);
  const res = createLoginToken(memberId, "month");
  const member = d.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member;
  const kind = r.contact_kind === "phone" && member.phone ? "phone" : member.email ? "email" : "phone";
  if (res.ok) await sendLoginCode(member, kind, res.token, res.code);
  return { ...r, ward_id: ward.id, member_id: memberId };
}

/** Declines a request. If they gave an email, they're told (with the note, if any). */
export async function declineWardRequest(id: number, note: string): Promise<WardRequest | null> {
  const r = db().prepare("SELECT * FROM ward_requests WHERE id = ? AND status = 'pending'").get(id) as WardRequest | undefined;
  if (!r) return null;
  db().prepare("UPDATE ward_requests SET status = 'declined', decided_at = datetime('now') WHERE id = ?").run(id);
  if (r.contact_kind === "email") {
    const text = `Hi ${r.name},\n\nThanks for your interest in My Ward Link. We weren't able to set up ${r.ward_name} at this time.${note ? `\n\n${note}` : ""}`;
    await sendMail({ to: r.contact, subject: "Your ward request", text, html: emailHtml("Your ward request", text, { url: appUrl(), label: "My Ward Link" }) });
  }
  return r;
}
