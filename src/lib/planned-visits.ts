import { DateTime } from "luxon";
import { db } from "./db";
import { audienceMembers, notify, recipientById, type Recipient } from "./notify";
import { signToken, validToken } from "./signed-links";
import { getOrg, orgFullName } from "./orgs";

// Visits the presidency has scheduled but not yet made. Shown as "Upcoming
// visits"; once one happens it's recorded in the visits table like any other.

export interface PlannedVisit {
  id: number;
  org_id: number;
  member_id: number;
  member_name: string;
  date: string;
  time: string | null;
  type: string;
  note: string;
  request_id: number | null;
  visitor_ids: string | null;
  visitors: string | null;
  invite_status: "pending" | "accepted" | "new_time" | "declined" | null;
  invite_message: string;
  member_reply: string;
  responded_at: string | null;
}

const SELECT = `SELECT p.*, m.display_name AS member_name,
    (SELECT group_concat(vv.member_id) FROM planned_visit_visitors vv WHERE vv.planned_id = p.id) AS visitor_ids,
    (SELECT group_concat(pm.display_name, ', ') FROM planned_visit_visitors vv JOIN members pm ON pm.id = vv.member_id WHERE vv.planned_id = p.id) AS visitors
  FROM planned_visits p JOIN members m ON m.id = p.member_id`;

/**
 * Agreed visits, soonest first (including ones whose date has passed but weren't
 * recorded). A visit sent as an invitation only counts once the member said yes.
 */
export function upcomingVisits(orgId: number, memberId?: number): PlannedVisit[] {
  return db()
    .prepare(
      `${SELECT} WHERE p.org_id = ? AND (p.invite_status IS NULL OR p.invite_status = 'accepted') ${memberId ? "AND p.member_id = ?" : ""} ORDER BY p.date, coalesce(p.time, '99:99'), p.id`,
    )
    .all(...(memberId ? [orgId, memberId] : [orgId])) as PlannedVisit[];
}

/** Invitations not settled yet: waiting for a reply, asked for another time, or declined. */
export function openInvitations(orgId: number, memberId?: number): PlannedVisit[] {
  return db()
    .prepare(
      `${SELECT} WHERE p.org_id = ? AND p.invite_status IN ('pending','new_time','declined') ${memberId ? "AND p.member_id = ?" : ""}
       ORDER BY CASE p.invite_status WHEN 'new_time' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, p.date, p.id`,
    )
    .all(...(memberId ? [orgId, memberId] : [orgId])) as PlannedVisit[];
}

export function getPlannedVisit(orgId: number, id: number): PlannedVisit | undefined {
  return db().prepare(`${SELECT} WHERE p.org_id = ? AND p.id = ?`).get(orgId, id) as PlannedVisit | undefined;
}

export function planForRequest(orgId: number, requestId: number): PlannedVisit | undefined {
  return db().prepare(`${SELECT} WHERE p.org_id = ? AND p.request_id = ? ORDER BY p.id DESC LIMIT 1`).get(orgId, requestId) as PlannedVisit | undefined;
}

export function visitorIds(p: Pick<PlannedVisit, "visitor_ids">): number[] {
  return (p.visitor_ids ?? "").split(",").filter(Boolean).map(Number);
}

export interface PlanInput {
  id?: number | null;
  orgId: number;
  memberId: number;
  date: string;
  time: string | null;
  type: string;
  note: string;
  requestId: number | null;
  visitors: number[];
  createdBy: number;
}

/** Creates or updates a planned visit and who's going. Returns its id. */
export function savePlan(p: PlanInput): number {
  const d = db();
  return d.transaction(() => {
    let id = p.id ?? null;
    if (id) {
      const r = d.prepare("UPDATE planned_visits SET member_id = ?, date = ?, time = ?, type = ?, note = ? WHERE id = ? AND org_id = ?").run(p.memberId, p.date, p.time, p.type, p.note, id, p.orgId);
      // Not this organization's plan: change nothing.
      if (r.changes === 0) throw new Error("Planned visit not found");
      d.prepare("DELETE FROM planned_visit_visitors WHERE planned_id = ?").run(id);
    } else {
      id = Number(
        d
          .prepare("INSERT INTO planned_visits (org_id, member_id, date, time, type, note, request_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(p.orgId, p.memberId, p.date, p.time, p.type, p.note, p.requestId, p.createdBy).lastInsertRowid,
      );
    }
    const ins = d.prepare("INSERT OR IGNORE INTO planned_visit_visitors (planned_id, member_id) VALUES (?, ?)");
    for (const v of p.visitors) ins.run(id, v);
    return id;
  })();
}

export function deletePlan(orgId: number, id: number) {
  db().prepare("DELETE FROM planned_visits WHERE id = ? AND org_id = ?").run(id, orgId);
}

/** "Tue, Oct 14 at 7:00 PM" (or just the day when there's no time). */
export function whenText(date: string, time: string | null) {
  const day = DateTime.fromISO(date).toFormat("ccc, LLL d");
  return time ? `${day} at ${DateTime.fromFormat(time, "HH:mm").toFormat("h:mm a")}` : day;
}

export const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && DateTime.fromISO(d).isValid;

/** Tells whoever was going that a planned visit was called off. */
export async function notifyVisitorsOfCancel(plan: PlannedVisit) {
  const recipients = visitorIds(plan)
    .map((v) => recipientById(v, plan.org_id))
    .filter((r): r is Recipient => !!r);
  if (recipients.length) await notify(recipients, { title: "Visit cancelled", body: `${plan.member_name} cancelled the visit planned for ${whenText(plan.date, plan.time)}.`, url: "/admin/visits" });
}

// ----- Personal visit invitations -----

export const inviteToken = (planId: number, memberId: number) => signToken(`visit:${planId}:${memberId}`);
export const validInviteToken = (planId: number, memberId: number, token: string) => validToken(`visit:${planId}:${memberId}`, token);
export const invitePath = (p: { id: number; member_id: number }) => `/visit-invite/${p.id}?t=${inviteToken(p.id, p.member_id)}`;

export { inviteMessage, joinNames } from "./invite-text";

/** Sends (or re-sends) the invitation and waits for the member's answer. */
export async function sendInvitation(plan: PlannedVisit, message: string, authorId: number) {
  const text = message.trim().slice(0, 1000);
  const d = db();
  d.prepare("UPDATE planned_visits SET invite_status = 'pending', invite_message = ?, member_reply = '', responded_at = NULL WHERE id = ?").run(text, plan.id);
  // Also in the member's Messages, so a text reply has context.
  d.prepare("INSERT INTO member_messages (org_id, member_id, direction, author_id, body) VALUES (?, ?, 'out', ?, ?)").run(plan.org_id, plan.member_id, authorId, text);
  const member = recipientById(plan.member_id, plan.org_id);
  if (member) {
    await notify([member], {
      title: `An invitation from the ${orgFullName(plan.org_id)} ${getOrg(plan.org_id)?.kind === "ward" ? "bishopric" : "presidency"}`,
      body: text,
      url: invitePath(plan),
      linkLabel: "Reply to the invitation",
      textLink: "Reply here",
      asMember: true,
    });
  }
}

export type InviteAnswer = "accepted" | "new_time" | "declined";

/** The member's answer. Tells the presidency. */
export async function answerInvitation(plan: PlannedVisit, answer: InviteAnswer, reply: string) {
  const text = reply.trim().slice(0, 500);
  db().prepare("UPDATE planned_visits SET invite_status = ?, member_reply = ?, responded_at = datetime('now') WHERE id = ?").run(answer, text, plan.id);
  const when = whenText(plan.date, plan.time);
  const body =
    answer === "accepted"
      ? `${plan.member_name} said ${when} works.${text ? ` "${text}"` : ""}`
      : answer === "new_time"
        ? `${plan.member_name} asked for another time than ${when}${text ? `: "${text}"` : "."}`
        : `${plan.member_name} would rather not have a visit right now.${text ? ` "${text}"` : ""}`;
  // Their answer also goes in their conversation with the presidency (right under the
  // invitation), so a leader can answer them there or by texting back.
  const said =
    answer === "accepted"
      ? `Yes, ${when} works for us.`
      : answer === "new_time"
        ? `Could we find a different date or time than ${when}?`
        : "Now is not a convenient time for us.";
  db()
    .prepare("INSERT INTO member_messages (org_id, member_id, direction, body, via) VALUES (?, ?, 'in', ?, 'app')")
    .run(plan.org_id, plan.member_id, `${said}${text ? ` ${text}` : ""}`);
  await notify(audienceMembers(plan.org_id, "presidency"), {
    title: answer === "accepted" ? "Visit confirmed" : answer === "new_time" ? "Another time, please" : "Visit invitation declined",
    body,
    url: "/admin/visits",
    // A leader texting back is answering this member (not whoever wrote last).
    replyTo: { memberId: plan.member_id, private: false },
  });
}

/** Invitations waiting for this member's answer. */
export function pendingInvitesFor(memberId: number, today: string): PlannedVisit[] {
  return db().prepare(`${SELECT} WHERE p.member_id = ? AND p.invite_status = 'pending' AND p.date >= ? ORDER BY p.date`).all(memberId, today) as PlannedVisit[];
}
