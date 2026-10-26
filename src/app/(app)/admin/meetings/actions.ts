"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { addAgendaItem, cleanVideoLink, inviteGroups, inviteToMeeting, uninviteFromMeeting, isMeetingRole, moveAgendaItem, setMeetingRole, createMeeting, deleteMeetingRecord, finishMeeting, getMeeting, reviewRecord, saveAgendaNotes, setVideoLink, syncMeetingEvent, videoKind, videoLink, type ReviewRecord } from "@/lib/meetings";
import { audienceMembers, notify, recipientById, type Recipient } from "@/lib/notify";
import { orgRoster } from "@/lib/orgs";
import { DateTime } from "luxon";
import { withOrg } from "@/lib/org-cookie";
import { leadersWord } from "@/lib/types";
import { ledOrgIds } from "@/lib/conversations";
import { formatDate, todayIn } from "@/lib/time";

/** Back to a page with a message (before any #section, so the message shows). */
function go(path: string, text: string): never {
  const [page, hash] = path.split("#");
  redirect(`${page}${page.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}${hash ? `#${hash}` : ""}`);
}

const meetingPath = (fd: FormData) => {
  const id = Number(fd.get("meeting_id"));
  return id ? `/admin/meetings/${id}` : "/admin/meetings";
};

export async function addAgenda(fd: FormData) {
  const user = await requirePresidency();
  const body = String(fd.get("body") || "").trim();
  if (!body) go(`${meetingPath(fd)}#agenda`, "Write the agenda item first.");
  const m = getMeeting(user.org_id, Number(fd.get("meeting_id")));
  addAgendaItem(user.org_id, body, { addedBy: user.id, meetingId: m?.kind === "invited" ? m.id : undefined });
  revalidatePath("/admin", "layout");
  go(`${meetingPath(fd)}#agenda`, "Added to the agenda.");
}

export async function removeAgenda(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("DELETE FROM agenda_items WHERE id = ? AND org_id = ?").run(Number(fd.get("item_id")), user.org_id);
  revalidatePath("/admin", "layout");
  go(`${meetingPath(fd)}#agenda`, "Taken off the agenda.");
}

// Moving an item, or choosing who prays, updates the page where it is (no redirect),
// so it doesn't jump back to the top.
export async function moveAgenda(fd: FormData) {
  const user = await requirePresidency();
  const dir = fd.get("dir");
  moveAgendaItem(user.org_id, Number(fd.get("item_id")), dir === "top" ? "top" : dir === "up" ? -1 : 1);
  revalidatePath("/admin", "layout");
}

/** Who gives the opening prayer, spiritual thought or closing prayer (saved as it's chosen). */
export async function saveMeetingRole(fd: FormData) {
  const user = await requirePresidency();
  const role = fd.get("role");
  const m = getMeeting(user.org_id, Number(fd.get("meeting_id")));
  if (!m || !isMeetingRole(role)) redirect("/admin/meetings");
  setMeetingRole(user.org_id, m.id, role, String(fd.get("name") || ""));
  revalidatePath("/admin/meetings", "layout");
}

export async function toggleDiscussed(fd: FormData) {
  const user = await requirePresidency();
  db().prepare("UPDATE agenda_items SET discussed = ? WHERE id = ? AND org_id = ?").run(fd.get("discussed") === "1" ? 1 : 0, Number(fd.get("item_id")), user.org_id);
  revalidatePath("/admin/meetings", "layout");
}

const timeOf = (fd: FormData) => (/^\d{2}:\d{2}$/.test(String(fd.get("time"))) ? String(fd.get("time")) : null);

/**
 * Schedules a meeting: it goes on the presidency's calendar and Coming up list. Another
 * meeting (not the presidency's own) opens next, to invite people to it.
 */
export async function newMeeting(fd: FormData) {
  const user = await requirePresidency();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("date"))) ? String(fd.get("date")) : todayIn(user.ward.timezone);
  const time = timeOf(fd);
  const title = String(fd.get("title") || "").trim().slice(0, 120);
  const invited = fd.get("kind") === "invited";
  if (invited && !title) go("/admin/meetings", "Give the meeting a title (for example, Activities committee).");
  const id = createMeeting(user.org_id, date, title, user.id, { time, tz: user.ward.timezone, kind: invited ? "invited" : "presidency", location: String(fd.get("location") || "") });
  revalidatePath("/", "layout");
  if (invited) go(`/admin/meetings/${id}#invite`, `${title} scheduled for ${formatDate(date, "short")}. Now invite people to it.`);
  go("/admin/meetings", time ? `Meeting scheduled for ${formatDate(date, "short")}. It's on the ${leadersWord(user.org)}'s calendar and Coming up list.` : `Meeting added for ${formatDate(date, "short")}.`);
}

/** An agenda item's wording and notes: ahead of time, or in the meeting. Saved in place. */
export async function saveItemNotes(fd: FormData) {
  const user = await requirePresidency();
  const itemId = Number(fd.get("item_id"));
  saveAgendaNotes(user.org_id, itemId, String(fd.get("notes") || ""), { body: fd.has("body") ? String(fd.get("body")) : undefined, beforehand: fd.get("beforehand") === "1" });
  revalidatePath("/admin/meetings", "layout");
}

export async function saveMeeting(fd: FormData) {
  const user = await requirePresidency();
  const m = getMeeting(user.org_id, Number(fd.get("meeting_id")));
  if (!m) go("/admin/meetings", "That meeting no longer exists.");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("date"))) ? String(fd.get("date")) : m.date;
  const attendees = [...fd.getAll("att").map(String), ...String(fd.get("att_other") || "").split(",")]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ")
    .slice(0, 500);
  const time = fd.has("time") ? timeOf(fd) : m.time;
  const title = String(fd.get("title") || "").trim().slice(0, 120) || (m.kind === "invited" ? m.title : "");
  const location = fd.has("location") ? String(fd.get("location") || "").trim().slice(0, 200) : m.location;
  db()
    .prepare("UPDATE meetings SET date = ?, time = ?, title = ?, location = ?, attendees = ?, notes = ?, updated_at = datetime('now') WHERE id = ?")
    .run(date, time, title, location, attendees, String(fd.get("notes") ?? m.notes).slice(0, 20000), m.id);
  if (date !== m.date || time !== m.time || title !== m.title || location !== m.location) syncMeetingEvent(user.org_id, m.id, user.ward.timezone, user.id);
  revalidatePath("/", "layout");
  go(`/admin/meetings/${m.id}`, "Notes saved.");
}

export async function finish(fd: FormData) {
  const user = await requirePresidency();
  const m = getMeeting(user.org_id, Number(fd.get("meeting_id")));
  if (!m) go("/admin/meetings", "That meeting no longer exists.");
  finishMeeting(user.org_id, m.id, todayIn(user.ward.timezone));
  revalidatePath("/admin", "layout");
  go(`/admin/meetings/${m.id}`, m.kind === "invited" ? "Meeting finished." : "Meeting finished. Items not discussed wait for the next meeting.");
}

export async function deleteMeeting(fd: FormData) {
  const user = await requirePresidency();
  deleteMeetingRecord(user.org_id, Number(fd.get("meeting_id")));
  revalidatePath("/admin", "layout");
  go("/admin/meetings", "Meeting and its notes deleted.");
}

export async function reviewAction(fd: FormData) {
  const user = await requirePresidency();
  const kind = String(fd.get("kind")) as ReviewRecord["kind"];
  if (!["meeting", "todo", "agenda"].includes(kind)) go("/admin/meetings/review", "Choose a record.");
  const keep = fd.get("decision") === "keep";
  reviewRecord(user.org_id, kind, Number(fd.get("id")), keep, todayIn(user.ward.timezone));
  revalidatePath("/admin", "layout");
  go("/admin/meetings/review", keep ? "Kept. It will come up again in 3 months." : "Deleted.");
}

/** A member's message, put on the next presidency meeting's agenda (from the conversation). */
export async function agendaFromMessage(fd: FormData) {
  const user = await requirePresidency();
  const msg = db()
    .prepare("SELECT mm.id, mm.org_id, mm.member_id, mm.body, mm.created_at, m.display_name FROM member_messages mm JOIN members m ON m.id = mm.member_id WHERE mm.id = ? AND mm.direction = 'in'")
    .get(Number(fd.get("message_id"))) as { id: number; org_id: number; member_id: number; body: string; created_at: string; display_name: string } | undefined;
  const back = String(fd.get("back") || "/messages");
  const safeBack = back.startsWith("/admin/replies/") ? back : "/messages";
  if (!msg || !ledOrgIds(user.id).includes(msg.org_id)) go(safeBack, "That message can't be added.");
  addAgendaItem(msg.org_id, msg.body, { source: `Message from ${msg.display_name}, ${formatDate(msg.created_at.slice(0, 10), "short")}`, link: `/admin/replies/${msg.member_id}`, addedBy: user.id });
  revalidatePath("/admin", "layout");
  go(safeBack, "Added to the next presidency meeting's agenda.");
}

export async function saveVideoLink(fd: FormData) {
  const user = await requirePresidency();
  const raw = String(fd.get("link") || "").trim();
  if (!raw) {
    setVideoLink(user.org_id, null);
    go("/admin/meetings", "Video meeting link removed.");
  }
  const link = cleanVideoLink(raw);
  if (!link) go("/admin/meetings", "Paste a Zoom, Google Meet or Teams meeting link (it starts with https://).");
  setVideoLink(user.org_id, link);
  revalidatePath("/admin/meetings");
  go("/admin/meetings", `${videoKind(link)} link saved. Tap Start to begin a meeting.`);
}

/** Opens the video meeting, and (if ticked) tells the rest of the presidency to join. */
export async function startVideo(fd: FormData) {
  const user = await requirePresidency();
  const link = videoLink(user.org_id);
  if (!link) go("/admin/meetings", "Add your meeting link first.");
  if (fd.get("notify") === "on") {
    const others = audienceMembers(user.org_id, "presidency").filter((r) => r.id !== user.id);
    await notify(others, {
      title: `${user.display_name} started a ${videoKind(link)} meeting`,
      body: `The ${leadersWord(user.org)} meeting is starting. Tap to join.`,
      url: withOrg("/admin/meetings/join", user.org_id),
      linkLabel: "Join",
    });
  }
  redirect(link);
}

/** Invites a group (the presidency, a calling, everyone) or one person, and tells them. */
export async function inviteToMeetingAction(fd: FormData) {
  const user = await requirePresidency();
  const m = getMeeting(user.org_id, Number(fd.get("meeting_id")));
  if (!m || m.kind !== "invited") go("/admin/meetings", "That meeting no longer exists.");
  const back = `/admin/meetings/${m.id}#invite`;
  const group = inviteGroups(user.org_id).find((g) => g.key === fd.get("group"));
  const person = Number(fd.get("member_id"));
  const ids = group ? group.ids : orgRoster(user.org_id).some((p) => p.id === person) ? [person] : [];
  if (!ids.length) go(back, "Choose who to invite.");
  const added = inviteToMeeting(m.id, ids);
  if (!added.length) go(back, "They're already invited.");
  const when = `${formatDate(m.date, "short")}${m.time ? ` at ${DateTime.fromFormat(m.time, "HH:mm").toFormat("h:mm a")}` : ""}`;
  await notify(
    added.map((id) => recipientById(id, user.org_id)).filter((r): r is Recipient => !!r),
    {
      title: `You're invited: ${m.title}`,
      body: `${when}${m.location ? ` · ${m.location}` : ""}. Tap to see the agenda and let us know if you can come.`,
      url: `/meetings/${m.id}`,
    },
    { followUp: { what: `Invited to ${m.title} (${when})`, url: `/admin/meetings/${m.id}` } },
  );
  revalidatePath("/", "layout");
  go(back, `${added.length} ${added.length === 1 ? "person" : "people"} invited and notified.`);
}

export async function uninviteAction(fd: FormData) {
  const user = await requirePresidency();
  const m = getMeeting(user.org_id, Number(fd.get("meeting_id")));
  if (!m) go("/admin/meetings", "That meeting no longer exists.");
  uninviteFromMeeting(m.id, Number(fd.get("member_id")));
  revalidatePath("/", "layout");
  go(`/admin/meetings/${m.id}#invite`, "Taken off the invitation list.");
}
