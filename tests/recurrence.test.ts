import { describe, expect, it } from "vitest";
import { describeRecurrence, occurrenceDates, patternOptions } from "@/lib/recurrence";

describe("repeating events", () => {
  it("offers choices that match the start date", () => {
    // Friday, October 16, 2026 is the third Friday of October.
    expect(patternOptions("2026-10-16").map((o) => o.label)).toEqual([
      "Every week on Friday",
      "Every 2 weeks on Friday",
      "Every month on the third Friday",
      "Every month on the 16th",
    ]);
    // Friday, October 30, 2026 is the fifth and last Friday.
    expect(patternOptions("2026-10-30").map((o) => o.value)).toEqual(["weekly", "biweekly", "monthly_last", "monthly_day"]);
    // Thursday, October 29 is the fourth and also the last Thursday.
    expect(patternOptions("2026-10-29").map((o) => o.value)).toContain("monthly_last");
  });

  it("finds the third Friday of every month", () => {
    const r = { pattern: "monthly_nth" as const, start: "2026-10-16", until: null, count: null };
    expect(occurrenceDates(r, "2026-10-01", "2027-03-31")).toEqual(["2026-10-16", "2026-11-20", "2026-12-18", "2027-01-15", "2027-02-19", "2027-03-19"]);
    expect(describeRecurrence(r)).toBe("Every month on the third Friday");
  });

  it("handles last weekday, month days, weeks, and the end choices", () => {
    expect(occurrenceDates({ pattern: "monthly_last", start: "2026-10-30", until: null, count: 3 }, "2026-01-01", "2030-01-01")).toEqual(["2026-10-30", "2026-11-27", "2026-12-25"]);
    expect(occurrenceDates({ pattern: "monthly_day", start: "2026-10-31", until: "2027-01-31", count: null }, "2026-01-01", "2030-01-01")).toEqual(["2026-10-31", "2026-12-31", "2027-01-31"]);
    expect(occurrenceDates({ pattern: "biweekly", start: "2026-10-16", until: "2026-11-15", count: null }, "2026-10-01", "2027-01-01")).toEqual(["2026-10-16", "2026-10-30", "2026-11-13"]);
    // Count includes dates before the window.
    expect(occurrenceDates({ pattern: "weekly", start: "2026-10-16", until: null, count: 3 }, "2026-10-20", "2027-01-01")).toEqual(["2026-10-23", "2026-10-30"]);
  });
});
