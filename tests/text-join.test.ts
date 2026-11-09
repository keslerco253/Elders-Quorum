import { describe, expect, it } from "vitest";

describe("joining ward texts by texting JOIN", () => {
  it("records a leader-added member's agreement and confirms; an unknown number is told to get added", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role) VALUES
        (1, 1, 'P', 'Pres Elder', 'p@t.l', '+12085550001', 'presidency'),
        (5, 1, 'E', 'Edna Elderly', NULL, '+12085550005', 'member');
    `);
    // Added by a leader: no agreement yet, nothing by text.
    d.prepare("UPDATE members SET sms_consent_at = NULL, contact_pref = 'none', always_text = 0, source = 'manual' WHERE id = 5").run();
    const inbound = await import("@/lib/sms-inbound");
    const out: { reply?: string } = {};
    expect(await inbound.handleInboundText({ From: "+12085550005", Body: "join" }, out)).toBe("joined");
    expect(out.reply).toMatch(/^Villas Ward texts: you're signed up! Msg freq varies\. Msg&data rates may apply\. Reply HELP for help, STOP to opt out\. App: http:\/\/localhost:3000\/in\/2085550005$/);
    expect(d.prepare("SELECT sms_consent_via, always_text, contact_pref, sms_consent_at IS NOT NULL AS agreed FROM members WHERE id = 5").get()).toEqual({
      sms_consent_via: "text",
      always_text: 1,
      contact_pref: "text",
      agreed: 1,
    });
    // It isn't saved as a message to the presidency.
    expect((d.prepare("SELECT COUNT(*) AS n FROM member_messages").get() as { n: number }).n).toBe(0);
    // JOIN again ("JOIN VILLAS" from a card too, not a message): already signed up, which
    // account, and where to sign in; their settings stay as they are.
    d.prepare("UPDATE members SET always_text = 0 WHERE id = 5").run();
    const card: { reply?: string } = {};
    expect(await inbound.handleInboundText({ From: "+12085550005", Body: "JOIN VILLAS" }, card)).toBe("ignored");
    expect(card.reply).toBe("Villas Ward: you're already signed up (Edna Elderly). Sign in to the app: http://localhost:3000/in/2085550005");
    expect((d.prepare("SELECT always_text FROM members WHERE id = 5").get() as { always_text: number }).always_text).toBe(0);
    expect((d.prepare("SELECT COUNT(*) AS n FROM member_messages").get() as { n: number }).n).toBe(0);

    // A number no one has added, where no ward takes members by text: how to get added.
    d.prepare("UPDATE wards SET texting_enabled = 0").run();
    const unknown: { reply?: string } = {};
    expect(await inbound.handleInboundText({ From: "+12085550999", Body: "JOIN" }, unknown)).toBe("unknown_sender");
    expect(unknown.reply).toMatch(/ask your ward leaders to add you/);
  });

  it("lets someone no one has added join by text: their name and organizations, then they're in", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres Elder', 'p@t.l', 'presidency');
    `);
    d.prepare("UPDATE wards SET texting_enabled = 1, join_code = 'VILLAS'").run();
    d.prepare("INSERT INTO orgs (ward_id, name, kind) VALUES (1, 'Relief Society', 'group')").run();
    const inbound = await import("@/lib/sms-inbound");
    const say = async (Body: string) => {
      const out: { reply?: string } = {};
      const result = await inbound.handleInboundText({ From: "+12085550777", Body }, out);
      return { result, reply: out.reply ?? "" };
    };
    expect((await say("Join")).reply).toMatch(/^Welcome to Villas Ward on My Ward Link! What's your first and last name\?/);
    expect((await say("ok")).reply).toMatch(/first and last name/);
    const orgs = await say("Jane Smith");
    expect(orgs.reply).toMatch(/^Thanks, Jane! Which are you part of\?/);
    expect(orgs.reply).toContain("1 Elders Quorum");
    expect(orgs.reply).toContain("2 Relief Society");
    const done = await say("2");
    expect(done.result).toBe("joined");
    expect(done.reply).toMatch(/^Villas Ward texts: you're signed up!/);
    expect(done.reply).toMatch(/App: http:\/\/localhost:3000\/in\/2085550777$/);
    const jane = d.prepare("SELECT id, display_name, status, always_text, sms_consent_via FROM members WHERE phone = '+12085550777'").get() as { id: number; display_name: string; status: string; always_text: number; sms_consent_via: string };
    expect(jane).toMatchObject({ display_name: "Jane Smith", status: "active", always_text: 1, sms_consent_via: "join-text" });
    const inOrgs = (d.prepare("SELECT o.name FROM org_members om JOIN orgs o ON o.id = om.org_id WHERE om.member_id = ? ORDER BY o.kind DESC, o.name").all(jane.id) as { name: string }[]).map((o) => o.name);
    expect(inOrgs).toEqual(["Ward", "Relief Society"]);
    const { newWardMembers } = await import("@/lib/new-members");
    expect(newWardMembers(1).find((m) => m.id === jane.id)?.how).toBe("text");
  });

  it("asks for the join code when the number serves more than one ward", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise'), (2, 'Maple Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres Elder', 'p@t.l', 'presidency');
    `);
    d.prepare("UPDATE wards SET texting_enabled = 1, join_code = CASE id WHEN 1 THEN 'VILLAS' ELSE 'MAPLE' END").run();
    d.prepare("UPDATE orgs SET active = 0 WHERE kind = 'group'").run();
    const inbound = await import("@/lib/sms-inbound");
    const say = async (From: string, Body: string) => {
      const out: { reply?: string } = {};
      await inbound.handleInboundText({ From, Body }, out);
      return out.reply ?? "";
    };
    expect(await say("+12085550111", "JOIN")).toMatch(/What's your ward's join code\?/);
    expect(await say("+12085550111", "nope")).toMatch(/didn't match/);
    expect(await say("+12085550111", "maple")).toMatch(/^Welcome to Maple Ward/);
    // No organizations to choose: in with their name.
    expect(await say("+12085550111", "Sam Lee")).toMatch(/^Maple Ward texts: you're signed up/);
    // JOIN with the code skips the question.
    expect(await say("+12085550222", "JOIN VILLAS")).toMatch(/^Welcome to Villas Ward/);
    // STOP ends it.
    await say("+12085550222", "STOP");
    expect(await say("+12085550222", "Pat Doe")).not.toMatch(/signed up/);
    // A number whose access was turned off can't come back in by text.
    d.prepare("INSERT INTO members (name, display_name, phone, status) VALUES ('Off', 'Off Person', '+12085550333', 'inactive')").run();
    expect(await say("+12085550333", "JOIN VILLAS")).toMatch(/access was turned off/);
    expect(await say("+12085550333", "Off Person")).not.toMatch(/signed up/);
    expect((d.prepare("SELECT COUNT(*) AS n FROM members WHERE phone = '+12085550333'").get() as { n: number }).n).toBe(1);
  });
});
