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

  it("becomes a to-do on that date, with text reminders a day and 3 hours before and the picture kept", async () => {
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
    const { photoToTodo } = await import("@/lib/photo-todo");
    const reply = await photoToTodo(1, [{ url: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1", type: "image/png" }], "");
    expect(reply).toMatch(/^Added to your to-dos: Wedding reception: Ashton Daniels & Brooke Boyle, Sat, Dec 12, 6:00 PM to 8:00 PM, 506 N 1000 E, Firth, Idaho\. Text reminders 1 day and 3 hours before\. http.*\/assignments\/mine\/\d+$/);
    const todo = d.prepare("SELECT * FROM personal_todos WHERE member_id = 1").get() as { title: string; due_date: string; due_time: string; notes: string; reminders: string; images: string };
    expect(todo).toMatchObject({ due_date: "2026-12-12", due_time: "18:00" });
    expect(todo.notes).toContain("Where: 506 N 1000 E, Firth, Idaho");
    expect(JSON.parse(todo.reminders).map((r: { when: string; text: unknown }) => [r.when, !!r.text])).toEqual([["m:1440", true], ["m:180", true]]);
    const images = JSON.parse(todo.images) as string[];
    expect(images).toHaveLength(1);
    const { readUpload } = await import("@/lib/uploads");
    expect(readUpload(images[0])?.type).toBe("image/png");
    // Claude got the picture itself.
    const call = (create.mock.calls[0] as unknown as [{ messages: { content: { type: string }[] }[] }])[0];
    expect(call.messages[0].content[0].type).toBe("image");

    // Through the texting number: only the site owner's pictures are read; the answer comes right away.
    const { handleInboundText } = await import("@/lib/sms-inbound");
    const out: { reply?: string } = {};
    expect(await handleInboundText({ From: "+12085550001", Body: "", NumMedia: "1", MediaUrl0: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME2", MediaContentType0: "image/png" }, out)).toBe("photo_todo");
    expect(out.reply).toMatch(/Reading the picture now/);
    const amy: { reply?: string } = {};
    expect(await handleInboundText({ From: "+12085550002", Body: "here's a picture", NumMedia: "1", MediaUrl0: "https://api.twilio.com/x", MediaContentType0: "image/png" }, amy)).not.toBe("photo_todo");
  });
});
