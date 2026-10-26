import { beforeEach, describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import {
  addAgendaItem,
  createMeeting,
  finishMeeting,
  getMeeting,
  inviteGroups,
  inviteToMeeting,
  invitedMeeting,
  meetingAgenda,
  meetingInvitees,
  pendingAgenda,
  respondToMeeting,
  saveAgendaNotes,
} from "@/lib/meetings";
import { eventAudience, eventsBetween, getEvent } from "@/lib/events";

describe("meetings the presidency invites people to", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'S', 'Sam', 's@x.com', 'member'), (3, 1, 'N', 'Ned', 'n@x.com', 'member');
    `);
    db().prepare("INSERT INTO org_callings (id, org_id, name) VALUES (1, 1, 'Activities Committee')").run();
    db().prepare("INSERT INTO member_callings (calling_id, member_id) VALUES (1, 2)").run();
  });

  const schedule = () => createMeeting(1, "2026-11-05", "Activities committee", 1, { time: "19:00", tz: "America/Boise", kind: "invited", location: "Church" });

  it("invites by calling or name, once each, and records answers", () => {
    const id = schedule();
    const groups = inviteGroups(1);
    expect(groups.map((g) => [g.label, g.ids])).toEqual([
      ["The presidency", [1]],
      ["Activities Committee", [2]],
      ["Everyone in Elders Quorum", [1, 2, 3]],
    ]);
    expect(inviteToMeeting(id, groups[1].ids)).toEqual([2]);
    expect(inviteToMeeting(id, [2, 3])).toEqual([3]);
    respondToMeeting(id, 3, "no");
    expect(meetingInvitees(id).map((i) => [i.display_name, i.response])).toEqual([
      ["Ned", "no"],
      ["Sam", null],
    ]);
    expect(invitedMeeting(2, id)?.title).toBe("Activities committee");
    expect(invitedMeeting(1, id)).toBeUndefined();
  });

  it("shows its event only to the presidency and the people invited, and reminds those coming", () => {
    const id = schedule();
    inviteToMeeting(id, [2, 3]);
    respondToMeeting(id, 3, "no");
    const eventId = getMeeting(1, id)!.event_id!;
    const ev = db().prepare("SELECT * FROM events WHERE id = ?").get(eventId) as Parameters<typeof eventAudience>[0];
    expect(eventAudience(ev).map((r) => r.id)).toEqual([2]);
    expect(getEvent(2, eventId)?.invited_meeting_id).toBe(id);
    expect(getEvent(1, eventId)?.location).toBe("Church");
    db().prepare("DELETE FROM meeting_invitees WHERE member_id = 3").run();
    expect(getEvent(3, eventId)).toBeUndefined();
    expect(eventsBetween(2, "2026-11-01T00:00:00Z", "2026-11-10T00:00:00Z", { joinedOnly: true }).map((e) => e.id)).toEqual([eventId]);
  });

  it("keeps its own agenda, apart from the presidency's", () => {
    const waiting = addAgendaItem(1, "Presidency item", { addedBy: 1 });
    const id = schedule();
    addAgendaItem(1, "Plan the Christmas party", { addedBy: 1, meetingId: id });
    addAgendaItem(1, "Service project", { addedBy: 1, meetingId: id });
    expect(meetingAgenda(id).map((a) => a.body)).toEqual(["Plan the Christmas party", "Service project"]);
    db().prepare("UPDATE agenda_items SET discussed = 1 WHERE id = ?").run(waiting);
    finishMeeting(1, id, "2026-11-05");
    expect(pendingAgenda(1).map((a) => a.body)).toEqual(["Presidency item"]);
    expect(meetingAgenda(id)).toHaveLength(2);
  });

  it("lets an agenda item be reworded and noted ahead of time without counting it discussed", () => {
    const a = addAgendaItem(1, "Ministring", { addedBy: 1 });
    saveAgendaNotes(1, a, "Bring the list", { body: "Ministering", beforehand: true });
    expect(pendingAgenda(1).map((x) => [x.body, x.notes, x.discussed])).toEqual([["Ministering", "Bring the list", 0]]);
    saveAgendaNotes(1, a, "Decided to swap two companionships");
    expect(pendingAgenda(1)[0].discussed).toBe(1);
  });
});
