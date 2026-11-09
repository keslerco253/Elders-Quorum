import { describe, expect, it } from "vitest";
import { smsBody } from "@/lib/notify";
import { smsSegments, SMS_DISCLOSURE } from "@/lib/sms";
import { fillTemplate, templateDef } from "@/lib/template-defs";

// Real-length names, titles and links: each of these texts should cost one segment.
const URL = "https://mywardlink.net/n/12345";
const EQ = "Elders Quorum";
const one = (text: string) => {
  expect(text.length, text).toBeLessThanOrEqual(160);
  expect(smsSegments(text)).toBe(1);
};

describe("texts fit in one segment", () => {
  it("reminders and notices", () => {
    one(smsBody(EQ, { title: "Will you teach on Nov 16?", body: "x", textFull: `Will you teach Sun, Nov 16 ("Be One with Christ" by Elder Quentin L. Cook)? Reply TEACH, or CANT and a reason.`, url: "/" }, URL));
    one(smsBody(EQ, { title: "You're teaching this Sunday", body: "x", textBody: `"Be One with Christ". Still teaching? Reply TEACH, or CANT and a reason.`, url: "/" }, URL));
    one(smsBody(EQ, { title: "You're teaching this Sunday", body: "x", textBody: `"Be One with Christ". Thanks for confirming! Plans changed? Reply CANT and why.`, url: "/" }, URL));
    one(smsBody(EQ, { title: "Private message from Hyrum Johnson", body: "x", textFull: "Private message from Hyrum Johnson. Read it in the app; to answer privately, reply to this text.", url: "/" }, URL));
    // "Tap to …" goes when it would make a second text, and a question mark isn't followed by a period.
    const ask = smsBody(EQ, { title: "Still waiting: would you accept this assignment?", body: "Visit Sister Allen with a meal. Tap to accept or let your presidency know you can't.", url: "/" }, URL);
    expect(ask).toBe(`${EQ}: Still waiting: would you accept this assignment? Visit Sister Allen with a meal. ${URL}`);
    one(ask);
    // Short enough already: kept as written.
    expect(smsBody(EQ, { title: "New event: Chili cook-off", body: "Fri, Nov 21 at 6:30 PM. Tap for the details.", url: "/" }, URL)).toContain("Tap for the details.");
  });

  it("the visit reminder to the member, signed", () => {
    const def = templateDef("visit_reminder_member")!;
    const words = fillTemplate(def.text!, { first_name: "Hyrum", who: "Mark Johnson and Sam Hill", visit_kind: "visit you in your home", day: "tomorrow", time: "7:00 PM" });
    one(smsBody(EQ, { title: "Visit reminder", body: "x", textFull: words, personal: { from: "The Elders Quorum presidency" }, url: "/" }, URL));
  });

  it("sign-in and joining", async () => {
    const footer = "\n@mywardlink.net #421367";
    one(`Villas Ward texts: 421367 is your sign-in code. ${SMS_DISCLOSURE}${footer}`);
    one(`Villas Ward texts: your code is 421367. ${SMS_DISCLOSURE}${footer}`);
    const { joinConfirmation, alreadyJoinedReply, loginLink } = await import("@/lib/text-join");
    const link = loginLink("+12085550100").replace("http://localhost:3000", "https://mywardlink.net");
    expect(link).toBe("https://mywardlink.net/in/2085550100");
    one(`${joinConfirmation("Villas Ward")} App: ${link}`);
    one(alreadyJoinedReply("+12085550100", ["Mark Johnson", "Jane Johnson"], "Villas Ward").replace("http://localhost:3000", "https://mywardlink.net"));
    const { GET } = await import("@/app/in/[phone]/route");
    expect((await GET(new Request("http://x/in/2085550100"), { params: Promise.resolve({ phone: "2085550100" }) })).headers.get("location")).toMatch(/\/login\?contact=2085550100$/);
  });
});
