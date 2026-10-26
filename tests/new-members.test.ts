import { describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { markNewMemberReviewed, newMembersToReview, newWardMembers } from "@/lib/new-members";
import { addToWard } from "@/lib/orgs";

describe("new members for ward administrators to review", () => {
  it("lists people who joined since, how they came, and clears them once reviewed", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise'), (2, 'Other', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
    `);
    const d = db();
    // Everyone already in the ward counts as reviewed.
    expect(newMembersToReview(1)).toBe(0);
    const add = (id: number, name: string, source: string) => {
      d.prepare("INSERT INTO members (id, name, display_name, email, source) VALUES (?, ?, ?, ?, ?)").run(id, name, name, `${id}@x.com`, source);
      addToWard(id, 1);
    };
    add(7, "Joe Joiner", "request");
    add(8, "Ann Added", "manual");
    addToWard(8, 2);
    expect(newMembersToReview(1)).toBe(2);
    const list = newWardMembers(1, { toReviewOnly: true });
    expect(list.map((m) => [m.display_name, m.how, m.other_wards])).toEqual(
      expect.arrayContaining([
        ["Joe Joiner", "code", 0],
        ["Ann Added", "leader", 1],
      ]),
    );
    expect(markNewMemberReviewed(1, 7, 1)).toBe(true);
    expect(newMembersToReview(1)).toBe(1);
    expect(newWardMembers(1).find((m) => m.id === 7)?.reviewed_by_name).toBe("Pres");
  });
});
