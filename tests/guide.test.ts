import { describe, expect, it } from "vitest";

describe("leader guide", () => {
  it("shows the presidency guide with a link to each topic", async () => {
    const { leaderGuide } = await import("@/lib/guide");
    const g = leaderGuide()!;
    expect(g.sections.map((s) => s.title)).toContain("Visits");
    expect(g.sections.map((s) => s.title)).toContain("A member's home page");
    expect(g.html).toContain('<h2 id="visits">');
    expect(g.html).not.toContain("<script");
  });
});
