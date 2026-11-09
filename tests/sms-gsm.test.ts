import { describe, expect, it } from "vitest";
import { smsSegments, toGsm7 } from "@/lib/sms";

describe("texts in the plain alphabet", () => {
  it("swaps curly quotes, arrows, ellipses and accents, so a text costs 153 letters a segment", () => {
    const teacher = toGsm7(`Villas Ward Elders Quorum: You're teaching tomorrow. ""“How Long Will It Be Ere They Believe Me?”"" by Elder Dale G. Renlund. Reply TEACH if you're still teaching, or CANT and a reason if you can't. https://mywardlink.net/n/340`);
    expect(teacher).toBe(`Villas Ward Elders Quorum: You're teaching tomorrow. "How Long Will It Be Ere They Believe Me?" by Elder Dale G. Renlund. Reply TEACH if you're still teaching, or CANT and a reason if you can't. https://mywardlink.net/n/340`);
    expect(smsSegments(teacher)).toBe(2);
    const approved = toGsm7(`Rimrock: Rimrock is approved and ready to use. Sign in to share its join code and set up its organizations. First, connect the ward's email account (Admin → Ward settings → Ward email): until you do, the app sends your members no email, only app notifications and texts. https://mywardlink.net/?org=15`);
    expect(approved).toContain("(Admin -> Ward settings -> Ward email)");
    expect(smsSegments(approved)).toBe(2);
    expect(toGsm7("Benjamín De Hoyos — “Talk” … 🖨️ Print ✓")).toBe('Benjamin De Hoyos - "Talk" ... Print');
    expect(toGsm7("café über")).toBe("café über");
  });
});
