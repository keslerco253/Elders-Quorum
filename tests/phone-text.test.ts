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
    const { phoneTextList } = await import("@/lib/phone-text");
    // Off for the ward: not offered.
    expect(phoneTextList({ id: 1 }, `aud:${eq}:everyone`)).toBeNull();
    d.prepare("UPDATE wards SET phone_texting = 1 WHERE id = ?").run(w.id);
    const all = phoneTextList({ id: 1 }, `aud:${eq}:everyone`)!;
    expect(all.people.map((p) => [p.name, p.phone])).toEqual([["Amy Allen", "+12085550002"], ["Ben Brown", null], ["Cal Cole", "+12085550004"]]);
    expect(phoneTextList({ id: 1 }, `aud:${eq}:presidency`)!.people.map((p) => p.name)).toEqual(["Cal Cole"]);
    expect(phoneTextList({ id: 1 }, `person:${eq}:2`)!.people.map((p) => p.name)).toEqual(["Amy Allen"]);
    // Not a leader there: nothing.
    expect(phoneTextList({ id: 2 }, `aud:${eq}:everyone`)).toBeNull();

    const { smsHref } = await import("@/lib/sms-link");
    expect(smsHref(["+12085550002", "+12085550004"], "Meeting at 7?", true)).toBe("sms:/open?addresses=+12085550002,+12085550004&body=Meeting%20at%207%3F");
    expect(smsHref(["+12085550002"], "Hi & bye", true)).toBe("sms:+12085550002&body=Hi%20%26%20bye");
    expect(smsHref(["+12085550002", "+12085550004"], "Hi", false)).toBe("sms:+12085550002,+12085550004?body=Hi");
  });
});
