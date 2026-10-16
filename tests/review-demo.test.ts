import { beforeAll, describe, expect, it } from "vitest";

describe("app review demo ward", () => {
  let d: import("better-sqlite3").Database;
  let demo: typeof import("@/lib/review-demo");
  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Real Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'real@x.com', 'presidency');
    `);
    demo = await import("@/lib/review-demo");
  });

  it("builds a ward of made-up people with sample content and a plain member account", () => {
    const { wardId, reviewerId } = demo.setUpReviewDemo("AppReview@Example.com", "America/Boise");
    expect(d.prepare("SELECT demo, pending, texting_enabled FROM wards WHERE id = ?").get(wardId)).toEqual({ demo: 1, pending: 0, texting_enabled: 0 });
    expect(d.prepare("SELECT email FROM members WHERE id = ?").get(reviewerId)).toEqual({ email: "appreview@example.com" });
    // Nobody else in it can be emailed or texted.
    const contacts = d.prepare("SELECT COUNT(*) AS n FROM members m JOIN ward_members wm ON wm.member_id = m.id WHERE wm.ward_id = ? AND m.id <> ? AND (m.email IS NOT NULL OR m.phone IS NOT NULL)").get(wardId, reviewerId) as { n: number };
    expect(contacts.n).toBe(0);
    expect(d.prepare("SELECT COUNT(*) AS n FROM org_members WHERE member_id = ? AND role = 'presidency'").get(reviewerId)).toEqual({ n: 0 });
    const counts = (t: string) => (d.prepare(`SELECT COUNT(*) AS n FROM ${t} x JOIN orgs o ON o.id = x.org_id WHERE o.ward_id = ?`).get(wardId) as { n: number }).n;
    expect(counts("lessons")).toBe(6);
    expect(counts("events")).toBe(3);
    expect(counts("signups")).toBe(1);
    expect(demo.onlyInDemoWards(reviewerId)).toBe(true);
    expect(demo.onlyInDemoWards(1)).toBe(false);
  });

  it("starts over cleanly, and never takes over a real person's email", () => {
    const again = demo.setUpReviewDemo("appreview@example.com", "America/Boise");
    expect(d.prepare("SELECT COUNT(*) AS n FROM wards WHERE demo = 1").get()).toEqual({ n: 1 });
    expect(d.prepare("SELECT COUNT(*) AS n FROM members WHERE email = 'appreview@example.com'").get()).toEqual({ n: 1 });
    expect(demo.onlyInDemoWards(again.reviewerId)).toBe(true);
    expect(() => demo.setUpReviewDemo("real@x.com", "America/Boise")).toThrow(/already belongs/);
    expect(d.prepare("SELECT COUNT(*) AS n FROM wards WHERE demo = 1").get()).toEqual({ n: 1 });
    // The real ward is untouched.
    expect(d.prepare("SELECT name FROM wards WHERE id = 1").get()).toEqual({ name: "Real Ward" });
  });
});
