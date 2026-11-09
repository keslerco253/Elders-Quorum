import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { useTestDb } from "@/lib/db";
import { collectDue, } from "@/lib/scheduler";
import { smsBody } from "@/lib/notify";
import { smsSegments } from "@/lib/sms";

describe("the lesson reminder text", () => {
  it("is one segment, ending in a short link straight to the talk", async () => {
    const d = useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role, last_login_at) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency', '2026-10-01');
      INSERT INTO lessons (id, ward_id, date, kind, title, speaker, url) VALUES (57, 1, '2026-11-15', 'talk', 'O Be Wise', 'President D. Todd Christofferson', 'https://www.churchofjesuschrist.org/study/general-conference/2026/10/o-be-wise?lang=eng');
    `);
    void d;
    const due = collectDue(DateTime.fromISO("2026-11-08T19:00", { zone: "America/Boise" }).toUTC()).find((n) => n.key.startsWith("lesson-sun"))!;
    expect(due.payload.textUrl).toBe("/l/57");
    const text = smsBody("Villas Ward Elders Quorum", due.payload, "https://mywardlink.net/l/57");
    expect(text).toBe("Villas Ward Elders Quorum: This Sunday's lesson: O Be Wise. By President D. Todd Christofferson. https://mywardlink.net/l/57");
    expect(smsSegments(text)).toBe(1);
    const { GET } = await import("@/app/l/[id]/route");
    const res = await GET(new Request("http://x/l/57"), { params: Promise.resolve({ id: "57" }) });
    expect(res.headers.get("location")).toContain("churchofjesuschrist.org/study/general-conference/2026/10/o-be-wise");
  });
});
