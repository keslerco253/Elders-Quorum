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
    expect(out.reply).toMatch(/^Villas Ward: you're signed up for ward texts\..*Reply HELP for help, STOP to opt out\.$/);
    expect(d.prepare("SELECT sms_consent_via, always_text, contact_pref, sms_consent_at IS NOT NULL AS agreed FROM members WHERE id = 5").get()).toEqual({
      sms_consent_via: "text",
      always_text: 1,
      contact_pref: "text",
      agreed: 1,
    });
    // It isn't saved as a message to the presidency.
    expect((d.prepare("SELECT COUNT(*) AS n FROM member_messages").get() as { n: number }).n).toBe(0);

    const unknown: { reply?: string } = {};
    expect(await inbound.handleInboundText({ From: "+12085550999", Body: "JOIN" }, unknown)).toBe("unknown_sender");
    expect(unknown.reply).toMatch(/ask your ward leaders to add you/);
    // Only once a day to the same number.
    const again: { reply?: string } = {};
    await inbound.handleInboundText({ From: "+12085550999", Body: "JOIN" }, again);
    expect(again.reply).toBeUndefined();
  });
});
