import { describe, expect, it } from "vitest";
import * as hb from "@/lib/handbook";

describe("General Handbook links", () => {
  it("use each chapter's own page name (a bare number opens the handbook's start for most chapters)", () => {
    expect(hb.handbookUrl(hb.orgChapter({ kind: "group", name: "Elders Quorum" })!)).toBe("https://www.churchofjesuschrist.org/study/manual/general-handbook/8-elders-quorum?lang=eng");
    expect(hb.handbookUrl(hb.TEACHING)).toBe("https://www.churchofjesuschrist.org/study/manual/general-handbook/17-teaching-the-gospel?lang=eng");
    for (const c of [hb.TEACHING, hb.ACTIVITIES, hb.MINISTERING, hb.TEMPORAL_NEEDS, hb.MEETINGS, hb.CALLINGS, hb.RECORDS]) expect(c.page).toMatch(new RegExp(`^${c.number}-[a-z-]+$`));
  });
});
