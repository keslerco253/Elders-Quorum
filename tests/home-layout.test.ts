import { beforeEach, describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { HOME_SECTIONS, homeLayout, moveHomeSection, resetHomeLayout, setHomeSectionHidden } from "@/lib/home-layout";

const usual = HOME_SECTIONS.map((s) => s.key);

describe("a member's Home layout", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, role) VALUES (1, 1, 'A', 'A', 'member'), (2, 1, 'B', 'B', 'member');
    `);
  });

  it("starts in the usual order with nothing hidden", () => {
    expect(homeLayout(1)).toEqual({ order: usual, hidden: [], custom: false });
  });

  it("moves, hides and resets, for that member only", () => {
    moveHomeSection(1, "coming_up", -1);
    moveHomeSection(1, "coming_up", -1);
    moveHomeSection(1, "assignments", -1); // already first: no change
    setHomeSectionHidden(1, "church_apps", true);
    const l = homeLayout(1);
    expect(l.order.slice(0, 4)).toEqual(["assignments", "coming_up", "conducting", "lessons"]);
    expect(l.hidden).toEqual(["church_apps"]);
    expect(homeLayout(2).order).toEqual(usual);
    setHomeSectionHidden(1, "church_apps", false);
    expect(homeLayout(1).hidden).toEqual([]);
    resetHomeLayout(1);
    expect(homeLayout(1)).toEqual({ order: usual, hidden: [], custom: false });
  });

  it("puts sections added later in their usual place, and drops ones that no longer exist", () => {
    db().prepare("UPDATE members SET home_layout = ? WHERE id = 1").run(JSON.stringify({ order: ["church_apps", "coming_up", "gone", "assignments"], hidden: ["gone"] }));
    expect(homeLayout(1).order).toEqual(["church_apps", "coming_up", "challenge", "serve", "visit", "assignments", "conducting", "lessons"]);
    expect(homeLayout(1).hidden).toEqual([]);
  });
});
