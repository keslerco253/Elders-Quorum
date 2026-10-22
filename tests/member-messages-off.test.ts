import { beforeEach, describe, expect, it } from "vitest";

describe("turning off members' messages", () => {
  let d: import("better-sqlite3").Database;
  let routing: typeof import("@/lib/message-routing");
  let compose: typeof import("@/lib/compose");
  let inbound: typeof import("@/lib/sms-inbound");
  beforeEach(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role) VALUES
        (1, 1, 'P', 'Pres Elder', 'p@t.l', '+12085550001', 'presidency'),
        (2, 1, 'F', 'First Counselor', 'f@t.l', '+12085550002', 'presidency'),
        (3, 1, 'M', 'Mary Member', 'm@t.l', '+12085550003', 'member');
      UPDATE members SET welcomed_at = datetime('now'), sms_consent_at = datetime('now');
    `);
    routing = await import("@/lib/message-routing");
    compose = await import("@/lib/compose");
    inbound = await import("@/lib/sms-inbound");
  });
  const eq = 1;
  const choices = (id: number) => compose.memberComposeChoices(id).flatMap((o) => o.choices.map((c) => c.value)).sort();
  const lastIn = () => d.prepare("SELECT COUNT(*) AS n FROM member_messages WHERE direction = 'in'").get() as { n: number };

  it("is on by default: the whole presidency and each leader privately", () => {
    expect(routing.orgTakesMessages(eq, 3)).toBe(true);
    expect(choices(3)).toEqual([`p:${eq}:0`, `p:${eq}:1`, `p:${eq}:2`]);
  });

  it("one leader turned off: no private messages to them, and they aren't notified", () => {
    d.prepare("UPDATE org_members SET member_messages = 0 WHERE org_id = ? AND member_id = 1").run(eq);
    expect(choices(3)).toEqual([`p:${eq}:0`, `p:${eq}:2`]);
    expect(routing.canWritePrivately(eq, 3, 1)).toBe(false);
    expect(routing.orgReceivers(eq, 3).map((r) => r.id)).toEqual([2]);
    // Every leader turned it off: the presidency is closed.
    d.prepare("UPDATE org_members SET member_messages = 0 WHERE org_id = ? AND member_id = 2").run(eq);
    expect(routing.orgTakesMessages(eq, 3)).toBe(false);
    expect(choices(3)).toEqual([]);
    // Leaders can still write to each other.
    expect(routing.orgTakesMessages(eq, 1)).toBe(true);
  });

  it("the presidency turned it off: texted replies aren't passed on, and the member is told once a day", async () => {
    d.prepare("UPDATE orgs SET member_messages = 0 WHERE id = ?").run(eq);
    expect(choices(3)).toEqual([]);
    d.prepare("UPDATE members SET last_text_org_id = ? WHERE id = 3").run(eq);
    const out: { reply?: string } = {};
    await inbound.handleInboundText({ From: "+12085550003", Body: "Can we talk?" }, out);
    expect(lastIn().n).toBe(0);
    const note = d.prepare("SELECT note FROM sms_inbound_log ORDER BY id DESC LIMIT 1").get() as { note: string };
    expect(note.note).toBe("Not passed on: Elders Quorum doesn't take messages");
    // Told by text the first time only (one a day), so it can't be used to run up texts.
    process.env.SMS_DEV_OUTBOX = "1";
    const sent = () => (d.prepare("SELECT COUNT(*) AS n FROM sms_log").get() as { n: number }).n;
    d.prepare("UPDATE orgs SET member_messages = 0 WHERE id = ?").run(eq);
    const before = sent();
    await inbound.handleInboundText({ From: "+12085550003", Body: "Hello?" }, out);
    await inbound.handleInboundText({ From: "+12085550003", Body: "Hello??" }, out);
    delete process.env.SMS_DEV_OUTBOX;
    expect(sent() - before).toBeLessThanOrEqual(1);
    expect(lastIn().n).toBe(0);
  });

  it("the ward turned it off: no New message choices at all, even groups", () => {
    d.prepare("UPDATE wards SET member_messages = 0 WHERE id = 1").run();
    expect(routing.orgTakesMessages(eq, 3)).toBe(false);
    expect(choices(3)).toEqual([]);
    expect(routing.orgTakesMessages(eq, 2)).toBe(true);
  });
});
