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
