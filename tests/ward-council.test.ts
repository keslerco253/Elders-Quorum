import { describe, expect, it } from "vitest";
import { useTestDb } from "@/lib/db";
import { addCouncilItem, councilItemToAgenda, fromCouncil, setShared, sharedLately, toShare } from "@/lib/ward-council";
import { finishMeeting, createMeeting, pendingAgenda, saveAgendaNotes } from "@/lib/meetings";

describe("ward council", () => {
  it("keeps what to share (ticked off once shared) and what to pass on, onto the agenda once", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
    `);
    const org = 1;
    const a = addCouncilItem(org, "share", "Jones family needs help moving", 1, null);
    expect(toShare(org).map((i) => i.body)).toEqual(["Jones family needs help moving"]);
    setShared(org, a, true);
    expect(toShare(org)).toEqual([]);
    expect(sharedLately(org).map((i) => i.id)).toEqual([a]);

    const f = addCouncilItem(org, "from", "Ward Christmas party Dec 12; elders set up tables", 1, "2026-11-08");
    const agendaId = councilItemToAgenda(org, f, 1)!;
    expect(councilItemToAgenda(org, f, 1)).toBe(agendaId);
    const item = pendingAgenda(org).find((x) => x.id === agendaId)!;
    expect(item).toMatchObject({ body: "Ward Christmas party Dec 12; elders set up tables", source: "From ward council, Sun, Nov 8", link: "/admin/meetings/ward-council" });
    expect(fromCouncil(org)[0]).toMatchObject({ on_agenda: 1, agenda_item_id: agendaId });
    // Discussed and filed with a meeting: no longer waiting on the agenda.
    const m = createMeeting(org, "2026-11-12", "", 1, { time: "19:00", tz: "America/Boise" });
    saveAgendaNotes(org, agendaId, "Assigned Brother Lee");
    finishMeeting(org, m, "2026-11-12");
    expect(fromCouncil(org)[0]).toMatchObject({ on_agenda: 0, agenda_item_id: agendaId });
  });
});
