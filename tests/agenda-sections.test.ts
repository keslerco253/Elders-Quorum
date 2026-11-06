import { describe, expect, it } from "vitest";
import { useTestDb } from "@/lib/db";
import { addAgendaItem, moveAgendaItem, pendingAgenda, setAgendaSection } from "@/lib/meetings";
import { groupBySection } from "@/lib/agenda-sections";
import { agendaPrintHtml } from "@/lib/agenda-print";
import { createMeeting } from "@/lib/meetings";

describe("agenda sections", () => {
  it("groups items by section, moves them within it, and prints them that way", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
    `);
    const org = 1;
    const pods = addAgendaItem(org, "Ministering (pods)", { addedBy: 1, section: "ministering" });
    const app = addAgendaItem(org, "Communications app", { addedBy: 1 });
    const jones = addAgendaItem(org, "Jones family", { addedBy: 1, section: "members" });
    const sec = addAgendaItem(org, "Secretary", { addedBy: 1, section: "nonsense" });
    const interviews = addAgendaItem(org, "Ministering interviews", { addedBy: 1, section: "ministering" });
    const ids = () => pendingAgenda(org).map((a) => a.id);
    expect(ids()).toEqual([app, sec, pods, interviews, jones]);
    expect(groupBySection(pendingAgenda(org)).map((g) => [g.label, g.items.length])).toEqual([
      ["Presidency business", 2],
      ["Ministering", 2],
      ["Members & families", 1],
    ]);
    // Moving stays inside the section.
    moveAgendaItem(org, interviews, "top");
    expect(ids()).toEqual([app, sec, interviews, pods, jones]);
    moveAgendaItem(org, interviews, -1);
    expect(ids()).toEqual([app, sec, interviews, pods, jones]);
    // Another section: to the bottom of it.
    setAgendaSection(org, app, "members");
    expect(ids()).toEqual([sec, interviews, pods, jones, app]);
    const m = createMeeting(org, "2026-11-04", "", 1, { time: "19:00", tz: "America/Boise" });
    const page = agendaPrintHtml(org, m)!;
    expect(page.indexOf("Presidency business")).toBeLessThan(page.indexOf("Ministering</h3>"));
    expect(page).toContain('<span class="n">5.</span><span class="body">Communications app');
  });
});

describe("printing finished meetings' notes", () => {
  it("prints each finished meeting with its items' notes, other notes and assignments", async () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
    `);
    const { saveAgendaNotes, finishMeeting } = await import("@/lib/meetings");
    const { pastNotesHtml } = await import("@/lib/agenda-print");
    const { db } = await import("@/lib/db");
    const m = createMeeting(1, "2026-10-04", "", 1, { time: "19:00", tz: "America/Boise" });
    const a = addAgendaItem(1, "Jones family", { addedBy: 1, section: "members" });
    addAgendaItem(1, "Not discussed", { addedBy: 1 });
    saveAgendaNotes(1, a, "Brother P will visit Thursday");
    db().prepare("UPDATE meetings SET attendees = 'Pres, Sam', notes = 'Stake conference next month' WHERE id = ?").run(m);
    finishMeeting(1, m, "2026-10-04");
    const page = pastNotesHtml(1, "3", "2026-11-02")!;
    expect(page).toContain("<h1>Meeting notes</h1>");
    expect(page).toContain("Brother P will visit Thursday");
    expect(page).toContain("Members &amp; families");
    expect(page).toContain("Pres, Sam");
    expect(page).toContain("Stake conference next month");
    expect(page).not.toContain("Not discussed");
    expect(pastNotesHtml(1, "3", "2027-06-01")).toContain("No finished meetings in that time.");
  });
});

describe("assignment review at the bottom of the agenda", () => {
  it("lists what was completed since the last presidency meeting and what's still open", async () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
      INSERT INTO todos (id, ward_id, title, assignee_id, due_date, created_by, done, done_at) VALUES
        (1, 1, 'Done before', 1, NULL, 1, 1, '2026-09-30 12:00:00'),
        (2, 1, 'Done since', 1, NULL, 1, 1, '2026-10-10 12:00:00'),
        (3, 1, 'Still open', 1, '2026-11-20', 1, 0, NULL);
    `);
    const { assignmentReview } = await import("@/lib/assignments");
    const { db } = await import("@/lib/db");
    const last = createMeeting(1, "2026-10-04", "", 1, { time: "19:00", tz: "America/Boise" });
    db().prepare("UPDATE meetings SET held_at = '2026-10-05 03:00:00' WHERE id = ?").run(last);
    const next = createMeeting(1, "2026-11-01", "", 1, { time: "19:00", tz: "America/Boise" });
    const r = assignmentReview(1, next);
    expect(r.since).toBe("2026-10-05 03:00:00");
    expect(r.completed.map((t) => t.title)).toEqual(["Done since"]);
    expect(r.open.map((t) => t.title)).toEqual(["Still open"]);
    const page = agendaPrintHtml(1, next)!;
    expect(page).toContain("Assignment review");
    expect(page).toContain("Done since");
    expect(page).not.toContain("Done before");
  });
});

describe("searching presidency meetings", () => {
  it("finds a word in agenda items, their notes, files, meeting notes and assignments", async () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
    `);
    const { searchMeetings, saveAgendaNotes, finishMeeting } = await import("@/lib/meetings");
    const { db } = await import("@/lib/db");
    const m = createMeeting(1, "2026-10-04", "", 1, { time: "19:00", tz: "America/Boise" });
    const a = addAgendaItem(1, "Bishop's storehouse order", { addedBy: 1 });
    saveAgendaNotes(1, a, "Talk to the STOREHOUSE manager");
    db().prepare("UPDATE meetings SET notes = 'Storehouse hours changed' WHERE id = ?").run(m);
    finishMeeting(1, m, "2026-10-04");
    addAgendaItem(1, "Next: storehouse volunteers", { addedBy: 1 });
    addAgendaItem(1, "Unrelated", { addedBy: 1 });
    db().prepare("INSERT INTO todos (org_id, title, created_by, meeting_id) VALUES (1, 'Call the storehouse', 1, ?)").run(m);
    const hits = searchMeetings(1, "storehouse");
    expect(hits.map((h) => [h.meeting ? "met" : "next", h.where])).toEqual([
      ["next", "Agenda item"],
      ["met", "Agenda item"],
      ["met", `Notes on "Bishop's storehouse order"`],
      ["met", "Meeting notes"],
      ["met", "Assignment from the meeting"],
    ]);
    expect(hits[1].href).toBe(`/admin/meetings/${m}#item-${a}`);
    expect(searchMeetings(1, "s")).toEqual([]);
    expect(searchMeetings(1, "100%")).toEqual([]);
  });
});
