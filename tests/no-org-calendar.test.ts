import { describe, expect, it } from "vitest";

describe("a ward member who hasn't chosen an organization", () => {
  it("sees the ward calendar (every organization's events, not leaders-only ones or anyone's personal events) and gets ward event notices", async () => {
    const d = (await import("@/lib/db")).useTestDb();
    const orgs = await import("@/lib/orgs");
    d.exec(`INSERT INTO members (id, name, display_name, email, status) VALUES (1, 'P', 'Pres', 'p@t.l', 'active'), (2, 'N', 'Nora New', 'n@t.l', 'active')`);
    const w = orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
    const ward = orgs.wardOrg(w.id).id;
    const eq = orgs.createOrg(w.id, "Elders Quorum").id;
    orgs.addToWard(2, w.id);
    d.prepare("INSERT OR REPLACE INTO org_members (org_id, member_id, role) VALUES (?, 1, 'presidency')").run(eq);
    const ev = d.prepare("INSERT INTO events (org_id, title, starts_at, ends_at, presidency_only) VALUES (?, ?, '2026-11-20T02:00:00Z', '2026-11-20T03:00:00Z', ?)");
    ev.run(ward, "Ward party", 0);
    ev.run(eq, "EQ service project", 0);
    ev.run(eq, "Presidency meeting", 1);
    d.prepare("INSERT INTO personal_events (member_id, title, date, start_time, end_time, timezone) VALUES (1, 'Pres dentist', '2026-11-19', '14:00', '15:00', 'America/Boise')").run();

    const { eventsBetween } = await import("@/lib/events");
    const { personalEventsBetween } = await import("@/lib/personal-events");
    const seen = (id: number) => eventsBetween(id, "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z", { wardId: w.id }).map((e) => e.title);
    expect(seen(2)).toEqual(["Ward party", "EQ service project"]);
    expect(seen(1)).toEqual(["Ward party", "EQ service project", "Presidency meeting"]);
    // Personal events are only ever their own.
    expect(personalEventsBetween(2, "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z")).toEqual([]);
    expect(personalEventsBetween(1, "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z").map((e) => e.title)).toEqual(["Pres dentist"]);
    // Ward-level notices ("everyone" at the ward level) reach them.
    const { audienceMembers } = await import("@/lib/notify");
    expect(audienceMembers(ward, "everyone").map((r) => r.id)).toContain(2);
    expect(audienceMembers(eq, "everyone").map((r) => r.id)).not.toContain(2);
  });
});
