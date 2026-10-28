import { describe, expect, it } from "vitest";
import { feedContents } from "@/lib/types";

describe("privacy of members' own reminders and calendars", () => {
  it("doesn't pass on a texted reply to a private reminder, then routes replies as before", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role) VALUES
        (1, 1, 'P', 'Pres Elder', 'p@t.l', '+12085550001', 'presidency'),
        (5, 1, 'M', 'Mary Member', NULL, '+12085550005', 'member');
    `);
    d.prepare("UPDATE members SET text_last_noreply = 1 WHERE id = 5").run();
    const inbound = await import("@/lib/sms-inbound");
    const out: { reply?: string } = {};
    expect(await inbound.handleInboundText({ From: "+12085550005", Body: "Running late to the dentist" }, out)).toBe("ignored");
    expect(out.reply).toBe(inbound.PRIVATE_REMINDER_REPLY);
    expect((d.prepare("SELECT COUNT(*) AS n FROM member_messages").get() as { n: number }).n).toBe(0);
    // The next text goes to the presidency as usual.
    await inbound.handleInboundText({ From: "+12085550005", Body: "Can someone help me move?" }, {});
    expect((d.prepare("SELECT COUNT(*) AS n FROM member_messages").get() as { n: number }).n).toBe(1);
  });

  it("keeps a subscribed calendar to ward events until the member chooses to add their own", () => {
    expect(feedContents({ feed_contents: "both", feed_contents_set_at: null })).toBe("ward");
    expect(feedContents({ feed_contents: "both", feed_contents_set_at: "2026-10-28 10:00:00" })).toBe("both");
    expect(feedContents({ feed_contents: "personal", feed_contents_set_at: "2026-10-28 10:00:00" })).toBe("personal");
  });
});
