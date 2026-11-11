import { afterEach, describe, expect, it, vi } from "vitest";

// Claude, standing in: reads the invitation as the real one would.
const create = vi.fn(async () => ({
  stop_reason: "end_turn",
  content: [
    {
      type: "text",
      text: JSON.stringify({
        found: true,
        title: "Wedding reception: Ashton Daniels & Brooke Boyle",
        date: "2026-12-12",
        start_time: "18:00",
        end_time: "20:00",
        location: "506 N 1000 E, Firth, Idaho",
        details: "Son of Adam and Rachael Daniels; daughter of Seth and Tiffany Boyle.",
        problem: "",
      }),
    },
  ],
}));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { create } }; } }));

// A tiny PNG (its first bytes are what's checked).
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

describe("a picture texted in by the site owner", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("becomes an event on their calendar, with its time and place, text reminders a day and 3 hours before, and the picture kept", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.TWILIO_ACCOUNT_SID = "AC1";
    process.env.TWILIO_AUTH_TOKEN = "t";
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role) VALUES
        (1, 1, 'M', 'Mark', 'm@x.com', '+12085550001', 'presidency'), (2, 1, 'A', 'Amy', 'a@x.com', '+12085550002', 'member');
    `);
    d.prepare("UPDATE members SET is_site_owner = 1 WHERE id = 1").run();
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).startsWith("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/")) {
          expect(new Headers(init?.headers).get("authorization")).toBe(`Basic ${Buffer.from("AC1:t").toString("base64")}`);
          return new Response(new Uint8Array(PNG), { headers: { "content-type": "image/png" } });
        }
        sent.push(String(init?.body ?? ""));
        return Response.json({ sid: "SM1" });
      }),
    );
    const { photoToEvent } = await import("@/lib/photo-event");
    const reply = await photoToEvent(1, [{ url: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1", type: "image/png" }], "");
    expect(reply).toMatch(/^Posted to your calendar: Wedding reception: Ashton Daniels & Brooke Boyle, Sat, Dec 12, 6:00 PM to 8:00 PM, 506 N 1000 E, Firth, Idaho\. Text reminders 1 day and 3 hours before\. http.*\/calendar\/mine\/\d+$/);
    const ev = d.prepare("SELECT * FROM personal_events WHERE member_id = 1").get() as { id: number; title: string; date: string; start_time: string; end_time: string; all_day: number; location: string; notes: string; reminders: string; images: string };
    expect(ev).toMatchObject({ date: "2026-12-12", start_time: "18:00", end_time: "20:00", all_day: 0, location: "506 N 1000 E, Firth, Idaho" });
    expect(ev.notes).toContain("Seth and Tiffany Boyle");
    expect(JSON.parse(ev.reminders).map((r: { when: string; text: unknown }) => [r.when, !!r.text])).toEqual([["m:1440", true], ["m:180", true]]);
    const images = JSON.parse(ev.images) as string[];
    expect(images).toHaveLength(1);
    const { readUpload } = await import("@/lib/uploads");
    expect(readUpload(images[0])?.type).toBe("image/png");
    // On their calendar that day, 6 to 8 PM, only theirs.
    const { personalEventsBetween, deletePersonalEvent } = await import("@/lib/personal-events");
    const onCalendar = personalEventsBetween(1, "2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z");
    expect(onCalendar.map((e) => [e.title, e.starts_at, e.ends_at])).toEqual([["Wedding reception: Ashton Daniels & Brooke Boyle", "2026-12-13T01:00:00Z", "2026-12-13T03:00:00Z"]]);
    expect(personalEventsBetween(2, "2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z")).toEqual([]);
    // Claude got the picture itself.
    const call = (create.mock.calls[0] as unknown as [{ messages: { content: { type: string }[] }[] }])[0];
    expect(call.messages[0].content[0].type).toBe("image");

    // Through the texting number: only the site owner's pictures are read; the answer comes right away.
    const { handleInboundText } = await import("@/lib/sms-inbound");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const out: { reply?: string } = {};
    expect(await handleInboundText({ From: "+12085550001", Body: "", NumMedia: "1", MediaUrl0: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME2", MediaContentType0: "image/png" }, out)).toBe("photo_todo");
    expect(out.reply).toMatch(/Reading the picture now/);
    // EVENT first (with a note), then the front and back as two texts: read together, as one to-do.
    // (The first picture is read once no more come.)
    await vi.runAllTimersAsync();
    const ready: { reply?: string } = {};
    expect(await handleInboundText({ From: "+12085550001", Body: "Event Brooke's wedding" }, ready)).toBe("photo_todo");
    expect(ready.reply).toMatch(/^Ready\. Send the picture/);
    const before = create.mock.calls.length;
    const front: { reply?: string } = {};
    const back: { reply?: string } = {};
    await handleInboundText({ From: "+12085550001", Body: "", NumMedia: "1", MediaUrl0: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME3", MediaContentType0: "image/png" }, front);
    await handleInboundText({ From: "+12085550001", Body: "", NumMedia: "1", MediaUrl0: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME4", MediaContentType0: "image/png" }, back);
    expect(front.reply).toMatch(/Reading the picture now/);
    expect(back.reply).toBeUndefined();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    await vi.waitFor(() => expect(create.mock.calls.length).toBe(before + 1));
    const batch = (create.mock.calls[before] as unknown as [{ messages: { content: { type: string; text?: string }[] }[] }])[0].messages[0].content;
    expect(batch.filter((b) => b.type === "image")).toHaveLength(2);
    expect(batch.find((b) => b.type === "text")?.text).toContain("Brooke's wedding");
    // Posted as one event, keeping both pictures.
    await vi.waitFor(() => expect(JSON.parse((d.prepare("SELECT images FROM personal_events ORDER BY id DESC LIMIT 1").get() as { images: string }).images)).toHaveLength(2));
    // Deleting the event deletes its pictures.
    const first = JSON.parse((d.prepare("SELECT images FROM personal_events WHERE id = ?").get(ev.id) as { images: string }).images) as string[];
    deletePersonalEvent(1, ev.id);
    expect(readUpload(first[0])).toBeNull();

    const amy: { reply?: string } = {};
    expect(await handleInboundText({ From: "+12085550002", Body: "here's a picture", NumMedia: "1", MediaUrl0: "https://api.twilio.com/x", MediaContentType0: "image/png" }, amy)).not.toBe("photo_todo");
  });
});
