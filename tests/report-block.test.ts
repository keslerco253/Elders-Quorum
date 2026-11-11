import { describe, expect, it } from "vitest";

describe("reporting and blocking", () => {
  it("hides a reported comment for whoever reported it and sends it to the presidency; blocking hides someone's comments", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'A', 'Amy', 'a@x.com', 'member'), (3, 1, 'B', 'Ben', 'b@x.com', 'member');
      INSERT INTO lessons (id, ward_id, date, kind) VALUES (5, 1, '2030-03-10', 'talk');
      INSERT INTO comments (id, lesson_id, member_id, body, status) VALUES
        (10, 5, 2, 'Rude comment', 'approved'), (11, 5, 3, 'Kind comment', 'approved'), (12, 5, 2, 'Reply to Ben', 'approved');
    `);
    d.prepare("UPDATE comments SET parent_id = 11 WHERE id = 12").run();
    const { commentThread } = await import("@/lib/lessons");
    const { reportComment, blockMember, unblockMember, openReports, handleReport, blockedBy } = await import("@/lib/moderation");
    const seen = (viewer: number) => commentThread(5, viewer).flatMap((c) => [c.body, ...c.replies.map((r) => r.body)]);
    expect(seen(3)).toEqual(["Rude comment", "Kind comment", "Reply to Ben"]);

    // Ben reports Amy's comment: gone for Ben at once, still there for others until the presidency decides.
    expect(reportComment(10, 3, "Not kind")).toEqual({ orgId: 1, lessonId: 5 });
    expect(seen(3)).toEqual(["Kind comment", "Reply to Ben"]);
    expect(seen(1)).toContain("Rude comment");
    expect(openReports(1).map((r) => [r.comment_id, r.reports, r.reasons])).toEqual([[10, 1, "Not kind"]]);
    // Can't report your own comment.
    expect(reportComment(11, 3, "")).toBeNull();

    // The presidency hides it: gone for everyone, and the report is done.
    expect(handleReport(1, 10, true, 1)).toBe(true);
    expect(seen(1)).not.toContain("Rude comment");
    expect(openReports(1)).toEqual([]);

    // Ben blocks Amy: none of her comments or replies show for him; unblocking brings them back.
    expect(blockMember(3, 2)).toBe(true);
    expect(blockMember(3, 3)).toBe(false);
    expect(seen(3)).toEqual(["Kind comment"]);
    expect(blockedBy(3).map((b) => b.display_name)).toEqual(["Amy"]);
    unblockMember(3, 2);
    expect(seen(3)).toEqual(["Kind comment", "Reply to Ben"]);
  });
});
