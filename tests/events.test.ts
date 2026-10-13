import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFor } from "@/lib/events";
import { localInputToUtc, sundays, utcToLocalInput } from "@/lib/time";

const e = { id: 7, ward_id: 1, title: "Service project; bring gloves", description: "Yard cleanup", location: "123 Main St, Boise", starts_at: "2026-10-17T15:00:00Z", ends_at: "2026-10-17T17:00:00Z", presidency_only: 0, rsvp_enabled: 0, reminder_minutes: 1440 };

describe("calendar", () => {
  it("builds a Google Calendar link", () => {
    const u = new URL(googleCalendarUrl(e));
    expect(u.searchParams.get("dates")).toBe("20261017T150000Z/20261017T170000Z");
    expect(u.searchParams.get("text")).toBe(e.title);
  });
  it("builds an escaped .ics file", () => {
    const ics = icsFor(e, "test");
    expect(ics).toContain("SUMMARY:Service project\\; bring gloves");
    expect(ics).toContain("LOCATION:123 Main St\\, Boise");
    expect(ics).toContain("DTSTART:20261017T150000Z");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
  it("converts ward-local times", () => {
    expect(localInputToUtc("2026-10-17T09:00", "America/Boise")).toBe("2026-10-17T15:00:00Z");
    expect(utcToLocalInput("2026-12-01T16:00:00Z", "America/Boise")).toBe("2026-12-01T09:00");
  });
  it("lists Sundays", () => {
    expect(sundays("2026-10-14", 3)).toEqual(["2026-10-18", "2026-10-25", "2026-11-01"]);
    expect(sundays("2026-10-18", 1)).toEqual(["2026-10-18"]);
  });
});

import { parseSlotLines } from "@/lib/signups";

describe("sign-up slots", () => {
  it("parses label | count lines", () => {
    expect(parseSlotLines("Helpers | 6\nMonday dinner\n\nTruck: 2\n")).toEqual([
      { label: "Helpers", capacity: 6 },
      { label: "Monday dinner", capacity: 1 },
      { label: "Truck", capacity: 2 },
    ]);
  });
});
