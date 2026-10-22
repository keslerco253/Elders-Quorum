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

describe("member guide", () => {
  it("is its own guide, searchable, and doesn't describe leader tools", async () => {
    const fs = await import("fs");
    const { loadGuide, searchGuide } = await import("@/lib/guide");
    const g = loadGuide("member")!;
    expect(g.sections.map((s) => s.title)).toContain("Notifications, texts and email");
    expect(searchGuide("STOP", "member").length).toBeGreaterThan(0);
    const md = fs.readFileSync("docs/MEMBER-GUIDE.md", "utf8");
    for (const leaderOnly of ["Admin →", "Ward settings", "Site owner", "Manage lessons", "Message wording", "Pass it on"]) expect(md).not.toContain(leaderOnly);
  });
});
