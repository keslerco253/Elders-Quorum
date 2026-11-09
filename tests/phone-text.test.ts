import { describe, expect, it } from "vitest";

describe("text from my phone", () => {
  it("lists who to text for a choice, only where the ward has it on, and builds the phone's text links", async () => {
    const d = (await import("@/lib/db")).useTestDb();
    const orgs = await import("@/lib/orgs");
    d.exec(`INSERT INTO members (id, name, display_name, email, phone, status) VALUES
      (1, 'P', 'Pres Person', 'p@t.l', '+12085550001', 'active'), (2, 'A', 'Amy Allen', 'a@t.l', '+12085550002', 'active'),
      (3, 'B', 'Ben Brown', 'b@t.l', NULL, 'active'), (4, 'C', 'Cal Cole', 'c@t.l', '+12085550004', 'active')`);
    const w = orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
    const eq = orgs.createOrg(w.id, "Elders Quorum").id;
    for (const id of [2, 3, 4]) orgs.addToWard(id, w.id);
    d.prepare("INSERT OR REPLACE INTO org_members (org_id, member_id, role, official, notify) VALUES (?, 1, 'presidency', 1, 1), (?, 2, 'member', 1, 1), (?, 3, 'member', 1, 1), (?, 4, 'presidency', 1, 1)").run(eq, eq, eq, eq);
    const { phoneTextData } = await import("@/lib/phone-text");
    // Off for the ward: not offered.
    expect(phoneTextData({ id: 1 }, `aud:${eq}:everyone`)).toBeNull();
    d.prepare("UPDATE wards SET phone_texting = 1 WHERE id = ?").run(w.id);
    const data = phoneTextData({ id: 1 }, `aud:${eq}:everyone`)!;
    // Everyone in the organization (not the leader), with their numbers and first names.
    expect(data.people.map((p) => [p.name, p.first, p.phone])).toEqual([["Amy Allen", "Amy", "+12085550002"], ["Ben Brown", "Ben", null], ["Cal Cole", "Cal", "+12085550004"]]);
    const ids = (v: string) => data.choices.find((c) => c.value === v)!.ids;
    expect(ids(`aud:${eq}:everyone`)).toEqual([2, 3, 4]);
    expect(ids(`aud:${eq}:presidency`)).toEqual([4]);
    expect(phoneTextData({ id: 1 }, `person:${eq}:2`)!.choices.at(-1)).toEqual({ value: `person:${eq}:2`, label: "Amy Allen", ids: [2] });
    expect(phoneTextData({ id: 1 }, `pick:${eq}`)!.initial).toBe(`pick:${eq}`);
    expect(data.links.map((l) => l.label)).toContain("Calendar");
    // Not a leader there: nothing.
    expect(phoneTextData({ id: 2 }, `aud:${eq}:everyone`)).toBeNull();

    const { personalText } = await import("@/lib/sms-link");
    const names = ["Amy", "Sam"];
    expect(personalText("This is a test", { first: "Hyrum", names })).toBe("Hyrum, this is a test");
    expect(personalText("I'll be late", { first: "Hyrum", names })).toBe("Hyrum, I'll be late");
    expect(personalText("Sam is bringing chairs.", { first: "Hyrum", names })).toBe("Hyrum, Sam is bringing chairs.");
    expect(personalText("EQ meets at 7", { first: "Hyrum", names, link: "https://mywardlink.net/calendar/4" })).toBe("Hyrum, EQ meets at 7\nhttps://mywardlink.net/calendar/4");
    expect(personalText("Same for all", { link: "https://x.org" })).toBe("Same for all\nhttps://x.org");
    const { smsHref } = await import("@/lib/sms-link");
    expect(smsHref(["+12085550002", "+12085550004"], "Meeting at 7?", true)).toBe("sms:/open?addresses=+12085550002,+12085550004&body=Meeting%20at%207%3F");
    expect(smsHref(["+12085550002"], "Hi & bye", true)).toBe("sms:+12085550002&body=Hi%20%26%20bye");
    expect(smsHref(["+12085550002", "+12085550004"], "Hi", false)).toBe("sms:+12085550002,+12085550004?body=Hi");
  });
});
