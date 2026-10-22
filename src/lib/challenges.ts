import { db } from "./db";

// Friendly challenges between organizations, e.g. temple and family history work.
// Teams are one or more organizations. Members log what they did; everyone sees only
// team totals.
// Each entry is seen only by whoever logged it, and 30 days after a challenge ends
// entries stop being tied to anyone.

export const DEFAULT_ITEMS: { label: string; points: number }[] = [
  { label: "Temple ordinances done", points: 1 },
  { label: "Family names taken to the temple", points: 1 },
  { label: "Hours of family history work", points: 1 },
  { label: "Hours of indexing", points: 1 },
  { label: "Stories or photos added to FamilySearch", points: 1 },
];

export interface Challenge {
  id: number;
  ward_id: number;
  org_id: number | null;
  title: string;
  starts_on: string;
  ends_on: string;
  created_by: number | null;
}

export interface ChallengeTeam {
  id: number;
  name: string;
  orgIds: number[];
}

export interface ChallengeItem {
  id: number;
  label: string;
  points: number;
}

export type ChallengeStatus = "upcoming" | "running" | "finished";

export const statusOf = (c: Pick<Challenge, "starts_on" | "ends_on">, today: string): ChallengeStatus =>
  today < c.starts_on ? "upcoming" : today > c.ends_on ? "finished" : "running";

export function getChallenge(wardId: number, id: number): Challenge | undefined {
  return db().prepare("SELECT * FROM challenges WHERE id = ? AND ward_id = ?").get(id, wardId) as Challenge | undefined;
}

export function listChallenges(wardId: number): Challenge[] {
  return db().prepare("SELECT * FROM challenges WHERE ward_id = ? ORDER BY ends_on DESC, id DESC LIMIT 50").all(wardId) as Challenge[];
}

export function challengeTeams(challengeId: number): ChallengeTeam[] {
  const teams = db().prepare("SELECT id, name FROM challenge_teams WHERE challenge_id = ? ORDER BY position, id").all(challengeId) as { id: number; name: string }[];
  return teams.map((t) => ({
    ...t,
    orgIds: (db().prepare("SELECT org_id FROM challenge_team_orgs WHERE team_id = ?").all(t.id) as { org_id: number }[]).map((r) => r.org_id),
  }));
}

export function challengeItems(challengeId: number): ChallengeItem[] {
  return db().prepare("SELECT id, label, points FROM challenge_items WHERE challenge_id = ? ORDER BY position, id").all(challengeId) as ChallengeItem[];
}

/**
 * Creates a challenge. Each organization can be on only one team; there must be at
 * least two teams and one thing that counts. Returns the id, or an error to show.
 */
export function createChallenge(
  wardId: number,
  orgId: number,
  createdBy: number,
  c: { title: string; starts_on: string; ends_on: string; teams: { name: string; orgIds: number[] }[]; items: { label: string; points: number }[] },
): { id: number } | { error: string } {
  const d = db();
  const wardOrgs = new Set((d.prepare("SELECT id FROM orgs WHERE ward_id = ? AND active = 1").all(wardId) as { id: number }[]).map((o) => o.id));
  const teams = c.teams.map((t) => ({ ...t, orgIds: [...new Set(t.orgIds)].filter((id) => wardOrgs.has(id)) })).filter((t) => t.orgIds.length);
  const items = c.items.map((i) => ({ label: i.label.trim().slice(0, 80), points: i.points })).filter((i) => i.label && Number.isFinite(i.points) && i.points > 0);
  if (!c.title.trim()) return { error: "Give the challenge a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.starts_on) || !/^\d{4}-\d{2}-\d{2}$/.test(c.ends_on) || c.ends_on < c.starts_on) return { error: "Choose a start date and an end date after it." };
  if (teams.length < 2) return { error: "Choose at least two teams, each with at least one organization." };
  const all = teams.flatMap((t) => t.orgIds);
  if (new Set(all).size !== all.length) return { error: "An organization can be on only one team." };
  if (!items.length) return { error: "Add at least one thing that counts." };
  const name = (ids: number[]) =>
    ids.map((id) => (d.prepare("SELECT CASE WHEN kind = 'ward' THEN 'Ward' ELSE name END AS n FROM orgs WHERE id = ?").get(id) as { n: string }).n).join(" + ");
  return d.transaction(() => {
    const id = Number(
      d.prepare("INSERT INTO challenges (ward_id, org_id, title, starts_on, ends_on, created_by) VALUES (?, ?, ?, ?, ?, ?)").run(wardId, orgId, c.title.trim().slice(0, 120), c.starts_on, c.ends_on, createdBy)
        .lastInsertRowid,
    );
    teams.forEach((t, i) => {
      const teamId = Number(d.prepare("INSERT INTO challenge_teams (challenge_id, name, position) VALUES (?, ?, ?)").run(id, t.name.trim().slice(0, 80) || name(t.orgIds), i).lastInsertRowid);
      for (const org of t.orgIds) d.prepare("INSERT INTO challenge_team_orgs (team_id, org_id) VALUES (?, ?)").run(teamId, org);
    });
    items.forEach((it, i) => d.prepare("INSERT INTO challenge_items (challenge_id, label, points, position) VALUES (?, ?, ?, ?)").run(id, it.label, it.points, i));
    return { id };
  })();
}

export interface TeamScore {
  team: ChallengeTeam;
  points: number;
}

/** Each team's total points, highest first. Totals only: no names. */
export function scoreboard(challengeId: number): TeamScore[] {
  const totals = new Map(
    (
      db()
        .prepare("SELECT e.team_id, SUM(e.amount * i.points) AS pts FROM challenge_entries e JOIN challenge_items i ON i.id = e.item_id WHERE e.challenge_id = ? GROUP BY e.team_id")
        .all(challengeId) as { team_id: number; pts: number }[]
    ).map((r) => [r.team_id, r.pts]),
  );
  return challengeTeams(challengeId)
    .map((team) => {
      return { team, points: Math.round((totals.get(team.id) ?? 0) * 10) / 10 };
    })
    .sort((a, b) => b.points - a.points);
}

/** The teams this member can log for: the ones with an organization they're in. */
export function memberTeams(challengeId: number, memberId: number): ChallengeTeam[] {
  const mine = new Set((db().prepare("SELECT org_id FROM org_members WHERE member_id = ?").all(memberId) as { org_id: number }[]).map((r) => r.org_id));
  return challengeTeams(challengeId).filter((t) => t.orgIds.some((id) => mine.has(id)));
}

/** Logs what someone did, while the challenge is running. Returns an error to show, or null. */
export function logEntry(c: Challenge, memberId: number, teamId: number, itemId: number, amount: number, today: string): string | null {
  if (statusOf(c, today) !== "running") return today < c.starts_on ? "The challenge hasn't started yet." : "The challenge has ended.";
  if (!memberTeams(c.id, memberId).some((t) => t.id === teamId)) return "Choose your team.";
  if (!challengeItems(c.id).some((i) => i.id === itemId)) return "Choose what you did.";
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) return "Enter how many (more than 0).";
  db().prepare("INSERT INTO challenge_entries (challenge_id, team_id, item_id, member_id, amount) VALUES (?, ?, ?, ?, ?)").run(c.id, teamId, itemId, memberId, Math.round(amount * 100) / 100);
  return null;
}

export interface MyEntry {
  id: number;
  label: string;
  amount: number;
  points: number;
  team: string;
  created_at: string;
}

/** What this member logged (only they ever see this). */
export function myEntries(challengeId: number, memberId: number): MyEntry[] {
  return db()
    .prepare(
      `SELECT e.id, i.label, e.amount, e.amount * i.points AS points, t.name AS team, e.created_at FROM challenge_entries e
       JOIN challenge_items i ON i.id = e.item_id JOIN challenge_teams t ON t.id = e.team_id
       WHERE e.challenge_id = ? AND e.member_id = ? ORDER BY e.id DESC`,
    )
    .all(challengeId, memberId) as MyEntry[];
}

/** Removes one of their own entries (while the challenge is running). */
export function deleteMyEntry(c: Challenge, memberId: number, entryId: number, today: string): boolean {
  if (statusOf(c, today) !== "running") return false;
  return db().prepare("DELETE FROM challenge_entries WHERE id = ? AND challenge_id = ? AND member_id = ?").run(entryId, c.id, memberId).changes > 0;
}

/** Running challenges with a team this member is on, for the home page. */
export function runningChallengesFor(wardId: number, memberId: number, today: string): Challenge[] {
  return listChallenges(wardId).filter((c) => statusOf(c, today) === "running" && memberTeams(c.id, memberId).length > 0);
}

/** Everyone on a challenge's teams (member ids), e.g. to tell them it started or who won. */
export function challengeMemberIds(challengeId: number): number[] {
  const orgIds = challengeTeams(challengeId).flatMap((t) => t.orgIds);
  if (!orgIds.length) return [];
  return (
    db()
      .prepare(
        `SELECT DISTINCT om.member_id FROM org_members om JOIN members m ON m.id = om.member_id
         WHERE om.org_id IN (${orgIds.map(() => "?").join(",")}) AND m.status = 'active' AND (om.official = 1 OR om.role <> 'member')`,
      )
      .all(...orgIds) as { member_id: number }[]
  ).map((r) => r.member_id);
}
