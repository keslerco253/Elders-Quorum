import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFor } from "@/lib/events";
import { localInputToUtc, sundays, utcToLocalInput } from "@/lib/time";

const e = { id: 7, ward_id: 1, title: "Service project; bring gloves", description: "Yard cleanup", location: "123 Main St, Boise", starts_at: "2026-10-17T15:00:00Z", ends_at: "2026-10-17T17:00:00Z", presidency_only: 0, rsvp_enabled: 0, reminder_minutes: 1440, series_id: null };

describe("calendar", () => {
  it("builds a Google Calendar link", () => {
    const u = new URL(googleCalendarUrl(e));
    expect(u.searchParams.get("dates")).toBe("20261017T150000Z/20261017T170000Z");
    expect(u.searchParams.get("text")).toBe(e.title);
  });
  it("builds an escaped .ics file", () => {
    const ics = icsFor(e, [], "test");
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

describe("calendar file links", () => {
  it("work only for the member and event they were made for", async () => {
    const { useTestDb } = await import("@/lib/db");
    useTestDb();
    const { icsPath, validIcsToken } = await import("@/lib/events");
    const link = new URL(icsPath(5, 9), "http://x");
    const t = link.searchParams.get("t")!;
    expect(link.pathname).toBe("/calendar/5/ics");
    expect(validIcsToken(5, 9, t)).toBe(true);
    expect(validIcsToken(5, 8, t)).toBe(false);
    expect(validIcsToken(6, 9, t)).toBe(false);
  });
});

describe("calendar subscription", () => {
  it("lists every event the member may see, and the link can be reset", async () => {
    const d = (await import("@/lib/db")).useTestDb();
    d.exec(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward Elders Quorum', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'M', 'Mem', 'm@x', 'member'), (2, 1, 'P', 'Pres', 'p@x', 'presidency');
      INSERT INTO events (ward_id, title, starts_at, ends_at, presidency_only) VALUES
        (1, 'Service project', strftime('%Y-%m-%dT%H:%M:%SZ','now','+3 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','+3 days','+2 hours'), 0),
        (1, 'Presidency meeting', strftime('%Y-%m-%dT%H:%M:%SZ','now','+4 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','+4 days','+1 hours'), 1);
    `);
    const ev = await import("@/lib/events");
    const { GET } = await import("@/app/feed/[member]/[token]/route");
    const fetchFeed = async (id: number, version = 0) => {
      const token = ev.feedPath({ id, feed_version: version }).split("/").pop()!;
      const res = await GET(new Request("http://x"), { params: Promise.resolve({ member: String(id), token }) });
      return { status: res.status, body: await res.text() };
    };
    const mem = await fetchFeed(1);
    expect(mem.status).toBe(200);
    expect(mem.body).toContain("X-WR-CALNAME:Villas Ward Elders Quorum");
    expect(mem.body).toContain("SUMMARY:Service project");
    expect(mem.body).not.toContain("Presidency meeting");
    expect((await fetchFeed(2)).body).toContain("SUMMARY:Presidency meeting");
    // After "Reset my link", the old link stops working.
    d.exec("UPDATE members SET feed_version = 1 WHERE id = 1");
    expect((await fetchFeed(1, 0)).status).toBe(404);
    expect((await fetchFeed(1, 1)).status).toBe(200);
    expect(ev.feedUrls({ id: 1, feed_version: 1 }).webcal).toMatch(/^webcal:\/\/.*\/feed\/1\/.+\.ics$/);
  });
});

describe("calendar reminders", () => {
  it("only allows the listed choices, at most two", async () => {
    const { parseAlerts } = await import("@/lib/events");
    expect(parseAlerts("1440,60")).toEqual([1440, 60]);
    expect(parseAlerts("60,60,999,15,30")).toEqual([60, 15]);
    expect(parseAlerts("")).toEqual([]);
  });

  it("adds an alarm per reminder to each event", async () => {
    const { icsFor } = await import("@/lib/events");
    const e = { id: 3, title: "Move", location: "", description: "", starts_at: "2026-10-17T15:00:00.000Z", ends_at: "2026-10-17T17:00:00.000Z" } as never;
    const ics = icsFor(e, [1440, 60], "test");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics).toContain("TRIGGER:-PT1440M");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(icsFor(e, [], "test")).not.toContain("VALARM");
  });
});
