import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db, useTestDb } from "@/lib/db";
import { collectDue } from "@/lib/scheduler";
import { runRetention } from "@/lib/retention";
import { challengeItems, challengeTeams, createChallenge, getChallenge, logEntry, memberTeams, myEntries, scoreboard, updateChallenge } from "@/lib/challenges";

describe("challenges between organizations", () => {
  let eq: number, rs: number, ym: number;
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'E', 'Elder', 'e@x.com', 'presidency'), (2, 1, 'S', 'Sister', 's@x.com', 'member'), (3, 1, 'T', 'Two', 't@x.com', 'member');
    `);
    const id = (name: string) => (db().prepare("SELECT id FROM orgs WHERE ward_id = 1 AND name = ?").get(name) as { id: number }).id;
    [eq, rs, ym] = [id("Elders Quorum"), id("Relief Society"), id("Young Men")];
    db().prepare("UPDATE orgs SET active = 1 WHERE ward_id = 1").run();
    // The sisters are in the Relief Society only.
    db().prepare("DELETE FROM org_members WHERE member_id IN (2, 3) AND org_id = ?").run(eq);
    db().prepare("INSERT OR REPLACE INTO org_members (org_id, member_id, role, official) VALUES (?, 1, 'presidency', 1), (?, 2, 'member', 1), (?, 3, 'member', 1)").run(eq, rs, rs);
  });

  it("checks the setup: two teams, no organization twice, something that counts", () => {
    const base = { title: "Temple challenge", starts_on: "2026-10-20", ends_on: "2026-11-30", items: [{ label: "Ordinances", points: 1 }] };
    expect(createChallenge(1, eq, 1, { ...base, teams: [{ name: "", orgIds: [eq] }] })).toEqual({ error: expect.stringMatching(/two teams/) });
    expect(createChallenge(1, eq, 1, { ...base, teams: [{ name: "", orgIds: [eq] }, { name: "", orgIds: [eq, rs] }] })).toEqual({ error: expect.stringMatching(/only one team/) });
    expect(createChallenge(1, eq, 1, { ...base, items: [], teams: [{ name: "", orgIds: [eq] }, { name: "", orgIds: [rs] }] })).toEqual({ error: expect.stringMatching(/at least one thing/) });
  });

  it("shows team totals only; each entry only to whoever logged it", () => {
    const res = createChallenge(1, eq, 1, {
      title: "Temple challenge",
      starts_on: "2026-10-20",
      ends_on: "2026-11-30",
      teams: [
        { name: "", orgIds: [eq, ym] },
        { name: "Sisters", orgIds: [rs] },
      ],
      items: [
        { label: "Ordinances", points: 1 },
        { label: "Hours of indexing", points: 2 },
      ],
    });
    if (!("id" in res)) throw new Error(res.error);
    const c = getChallenge(1, res.id)!;
    const [ord, hours] = challengeItems(c.id);
    const [men, sisters] = memberTeams(c.id, 1).concat(memberTeams(c.id, 2));
    expect(men.name).toBe("Elders Quorum + Young Men");
    expect(logEntry(c, 2, men.id, ord.id, 3, "2026-10-22")).toBe("Choose your team."); // not on that team
    expect(logEntry(c, 1, men.id, ord.id, 4, "2026-10-22")).toBeNull();
    expect(logEntry(c, 2, sisters.id, hours.id, 1.5, "2026-10-22")).toBeNull();
    expect(logEntry(c, 3, sisters.id, ord.id, 1, "2026-10-22")).toBeNull();
    expect(logEntry(c, 3, sisters.id, ord.id, 1, "2026-12-01")).toBe("The challenge has ended.");
    expect(scoreboard(c.id).map((b) => [b.team.name, b.points])).toEqual([
      ["Elders Quorum + Young Men", 4],
      ["Sisters", 4],
    ]);
    expect(myEntries(c.id, 2).map((e) => e.label)).toEqual(["Hours of indexing"]);
    expect(myEntries(c.id, 1).map((e) => e.label)).toEqual(["Ordinances"]);

    // The day after it ends, everyone hears the final scores.
    const done = collectDue(DateTime.fromISO("2026-12-01T10:00", { zone: "America/Boise" }).toUTC()).filter((n) => n.key.startsWith("challenge-end"));
    expect(done).toHaveLength(1);
    expect(done[0].payload.title).toMatch(/tie/);
    expect(done[0].recipients.map((r) => r.id).sort()).toEqual([1, 2, 3]);

    // 30 days after it ends, entries stop being tied to anyone; the totals stay.
    db().prepare("UPDATE challenges SET ends_on = date('now', '-31 days') WHERE id = ?").run(c.id);
    runRetention();
    expect(myEntries(c.id, 2)).toEqual([]);
    expect(scoreboard(c.id).map((b) => b.points)).toEqual([4, 4]);
  });

  it("can be changed: name, dates, points, teams; removing something removes its points", () => {
    const res = createChallenge(1, eq, 1, {
      title: "Temple challenge",
      starts_on: "2026-10-20",
      ends_on: "2026-11-30",
      teams: [
        { name: "", orgIds: [eq] },
        { name: "", orgIds: [rs] },
      ],
      items: [
        { label: "Ordinances", points: 1 },
        { label: "Indexing hours", points: 1 },
      ],
    });
    if (!("id" in res)) throw new Error(res.error);
    const c = getChallenge(1, res.id)!;
    const [ord, idx] = challengeItems(c.id);
    const [men, sisters] = challengeTeams(c.id);
    logEntry(c, 1, men.id, ord.id, 3, "2026-10-22");
    logEntry(c, 2, sisters.id, idx.id, 2, "2026-10-22");
    const upd = updateChallenge(1, c.id, {
      title: "Fall temple challenge",
      starts_on: "2026-10-20",
      ends_on: "2026-12-15",
      teams: [
        { id: men.id, name: "The Elders", orgIds: [eq] },
        { id: sisters.id, name: "", orgIds: [rs] },
        { name: "", orgIds: [ym] },
      ],
      items: [{ id: ord.id, label: "Ordinances", points: 2 }],
    });
    expect(upd).toEqual({ id: c.id });
    expect(getChallenge(1, c.id)).toMatchObject({ title: "Fall temple challenge", ends_on: "2026-12-15" });
    // Ordinances now 2 points each; indexing (and its points) is gone; a third team joined.
    expect(scoreboard(c.id).map((b) => [b.team.name, b.points])).toEqual([
      ["The Elders", 6],
      ["Relief Society", 0],
      ["Young Men", 0],
    ]);
    expect(updateChallenge(1, c.id, { title: "x", starts_on: "2026-10-20", ends_on: "2026-12-15", teams: [{ name: "", orgIds: [eq] }], items: [{ label: "a", points: 1 }] })).toEqual({
      error: expect.stringMatching(/two teams/),
    });
  });
});
