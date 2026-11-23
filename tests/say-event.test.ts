import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-say-event-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";
process.env.ANTHROPIC_API_KEY = "test";

// Claude, standing in: answers with whatever the test sets.
const base = { kind: "mine", org_id: 0, title: "", date: "", start_time: "", end_time: "", all_day: false, location: "", notes: "", leaders_only: false, ready: false, question: "" };
let reading: object = base;
const create = vi.fn(async (_req: unknown) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reading) }] }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { create } }; } }));

describe("say an event", () => {
  it("asks for what's missing, never trusts a half-read event, and adds only what the person may add", async () => {
    const { useTestDb } = await import("@/lib/db");
    const d = useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', '+12085550001', 'presidency'),
        (2, 1, 'A', 'Amy', 'a@x.com', '+12085550002', 'member');
    `);
    const s = await import("@/lib/say-event");
    const leaderChoices = s.eventOrgChoices(1);
    const org = (d.prepare("SELECT org_id FROM org_members WHERE member_id = 1 AND role = 'presidency'").get() as { org_id: number }).org_id;
    expect(leaderChoices.map((c) => c.id)).toContain(org);
    expect(s.eventOrgChoices(2)).toEqual([]);

    // No time yet: not ready, and the question is asked even if Claude says it's ready.
    const partial = s.checkDraft({ ...base, title: "Wilson move-in", date: "2026-11-28", ready: true } as never, leaderChoices);
    expect(partial.ready).toBe(false);
    expect(partial.question).toMatch(/time/i);

    // Claude's question comes back as is.
    reading = { ...base, kind: "org", org_id: org, title: "Wilson family move-in", date: "2026-11-28", question: "What time does it start?" };
    const step = await s.readSpokenEvent([{ who: "member", text: "Wilson family move-in Saturday for the quorum" }], { memberId: 1, tz: "America/Boise", choices: leaderChoices });
    expect(step).toMatchObject({ ready: false, question: "What time does it start?" });

    // A member can't put it on an organization's calendar: it's theirs.
    const memberStep = s.checkDraft({ ...base, kind: "org", org_id: org, title: "Dentist", date: "2026-12-01", start_time: "14:00" } as never, []);
    expect(memberStep.draft.kind).toBe("mine");
    const mine = s.addSpokenEvent(2, memberStep.draft, [], "America/Boise");
    expect(mine?.url).toMatch(/^\/calendar\/mine\/\d+$/);
    expect(d.prepare("SELECT title, date, start_time FROM personal_events WHERE member_id = 2").get()).toEqual({ title: "Dentist", date: "2026-12-01", start_time: "14:00" });

    // A leader's, leaders only, on the organization's calendar (9 AM Boise is 16:00 UTC).
    const leaderStep = s.checkDraft({ ...base, kind: "org", org_id: org, title: "Wilson family move-in", date: "2026-11-28", start_time: "09:00", end_time: "12:00", location: "123 Main", leaders_only: true } as never, leaderChoices);
    expect(leaderStep.ready).toBe(true);
    const added = s.addSpokenEvent(1, leaderStep.draft, leaderChoices, "America/Boise");
    expect(added?.where).toMatch(/leaders only/);
    expect(d.prepare("SELECT org_id, title, location, starts_at, ends_at, presidency_only, reminder_minutes FROM events WHERE title = 'Wilson family move-in'").get()).toEqual({
      org_id: org,
      title: "Wilson family move-in",
      location: "123 Main",
      starts_at: "2026-11-28T16:00:00Z",
      ends_at: "2026-11-28T19:00:00Z",
      presidency_only: 1,
      reminder_minutes: 1440,
    });
  });

  it("by text: a leader texts EVENT, answers what's asked, and it's added; SKIP stops; members' texts aren't events", async () => {
    const { db } = await import("@/lib/db");
    const { handleInboundText } = await import("@/lib/sms-inbound");
    const d = db();
    d.exec("UPDATE wards SET texting_enabled = 1; UPDATE members SET sms_consent_at = datetime('now')");
    const org = (d.prepare("SELECT org_id FROM org_members WHERE member_id = 1 AND role = 'presidency'").get() as { org_id: number }).org_id;

    reading = { ...base, kind: "org", org_id: org, title: "Service project", date: "2026-12-05", question: "What time does it start?" };
    const first: { reply?: string } = {};
    expect(await handleInboundText({ From: "+12085550001", Body: "EVENT service project Dec 5 for the quorum" }, first)).toBe("text_event");
    expect(first.reply).toBe("My Ward Link: What time does it start? (Reply SKIP to cancel.)");

    reading = { ...base, kind: "org", org_id: org, title: "Service project", date: "2026-12-05", start_time: "09:00", ready: true };
    const second: { reply?: string } = {};
    expect(await handleInboundText({ From: "+12085550001", Body: "9am" }, second)).toBe("text_event");
    expect(second.reply).toMatch(/^My Ward Link: Added to the .+ calendar: Service project, Sat, Dec 5, 9:00 AM\. Change it here: \S+\/calendar\/\d+\?org=\d+$/);
    // The conversation sent the first answer along with the second.
    const lastPrompt = JSON.stringify((create.mock.calls.at(-1)?.[0] as { messages: unknown }).messages);
    expect(lastPrompt).toContain("service project Dec 5");
    expect(lastPrompt).toContain("9am");
    expect(d.prepare("SELECT COUNT(*) AS n FROM events WHERE title = 'Service project'").get()).toEqual({ n: 1 });

    // SKIP ends one that's going.
    reading = { ...base, title: "Lunch", question: "What day is it?" };
    await handleInboundText({ From: "+12085550001", Body: "event lunch with the bishop" }, {});
    const skip: { reply?: string } = {};
    expect(await handleInboundText({ From: "+12085550001", Body: "skip" }, skip)).toBe("text_event");
    expect(skip.reply).toMatch(/wasn't added/);

    // A member's "event …" text is just a message to the presidency.
    expect(await handleInboundText({ From: "+12085550002", Body: "EVENT question: is the party still on?" }, {})).not.toBe("text_event");
  });
});
