import { beforeAll, describe, expect, it } from "vitest";

describe("events that invite other organizations", () => {
  let d: import("better-sqlite3").Database;
  let ev: typeof import("@/lib/events");
  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@t.l', 'presidency'), (2, 1, 'S', 'Sister', 's@t.l', 'member'), (3, 1, 'Y', 'Youth', 'y@t.l', 'member');
    `);
    // 1 = Elders Quorum, 3 = Relief Society, 5 = Young Women.
    d.exec(`UPDATE orgs SET active = 1 WHERE id IN (3, 5);
      DELETE FROM org_members WHERE member_id IN (2, 3) AND org_id = 1;
      INSERT OR IGNORE INTO org_members (org_id, member_id) VALUES (3, 2), (5, 3);
      INSERT INTO events (id, org_id, title, starts_at, ends_at, invited) VALUES
        (10, 1, 'Temple night', '2026-11-05T02:00:00Z', '2026-11-05T04:00:00Z', '3'),
        (11, 1, 'Quorum dinner', '2026-11-06T02:00:00Z', '2026-11-06T04:00:00Z', ''),
        (12, 1, 'Ward service day', '2026-11-07T16:00:00Z', '2026-11-07T19:00:00Z', 'ward');`);
    ev = await import("@/lib/events");
  });
  const titles = (rows: { title: string }[]) => rows.map((r) => r.title).sort();
  const range = ["2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z"] as const;

  it("shows on the invited organization's calendar and its members' own calendars", () => {
    expect(titles(ev.eventsBetween(2, ...range, { joinedOnly: true }))).toEqual(["Temple night", "Ward service day"]);
    expect(titles(ev.eventsBetween(3, ...range, { joinedOnly: true }))).toEqual(["Ward service day"]);
    expect(titles(ev.eventsBetween(2, ...range, { wardId: 1, orgIds: [3] }))).toEqual(["Temple night", "Ward service day"]);
    expect(titles(ev.eventsBetween(1, ...range, { wardId: 1, orgIds: [1] }))).toEqual(["Quorum dinner", "Temple night", "Ward service day"]);
  });

  it("sends reminders to the invited organizations too, once each", () => {
    const ids = (id: number) => ev.eventAudience(d.prepare("SELECT org_id, invited, presidency_only FROM events WHERE id = ?").get(id) as never).map((r) => r.id).sort();
    expect(ids(10)).toEqual([1, 2]);
    expect(ids(11)).toEqual([1]);
    expect(ids(12)).toEqual([1, 2, 3]);
  });
});
