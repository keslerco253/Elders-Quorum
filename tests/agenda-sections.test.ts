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
