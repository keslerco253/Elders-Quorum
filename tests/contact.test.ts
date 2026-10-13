import { describe, expect, it } from "vitest";
import { fallbackChannels, formatPhone, normalizePhone, parseContact } from "@/lib/contact";

describe("contacts", () => {
  it("normalizes phone numbers", () => {
    expect(normalizePhone("(208) 555-0142")).toBe("+12085550142");
    expect(normalizePhone("1-208-555-0142")).toBe("+12085550142");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("555-0142")).toBeNull();
    expect(formatPhone("+12085550142")).toBe("(208) 555-0142");
  });

  it("tells phones from emails", () => {
    expect(parseContact("Bob@Example.com ")).toEqual({ kind: "email", value: "bob@example.com" });
    expect(parseContact("208.555.0142")).toEqual({ kind: "phone", value: "+12085550142" });
    expect(parseContact("bob@")).toBeNull();
    expect(parseContact("hello")).toBeNull();
  });

  it("picks how to reach someone without push", () => {
    const both = { email: "a@b.co", phone: "+12085550142" };
    expect(fallbackChannels({ ...both, contact_pref: "email" }, true)).toEqual(["email"]);
    expect(fallbackChannels({ ...both, contact_pref: "text" }, true)).toEqual(["text"]);
    expect(fallbackChannels({ ...both, contact_pref: "both" }, true)).toEqual(["email", "text"]);
    expect(fallbackChannels({ ...both, contact_pref: "none" }, true)).toEqual([]);
    // Texting unavailable (not set up, or monthly limit reached): fall back to email.
    expect(fallbackChannels({ ...both, contact_pref: "text" }, false)).toEqual(["email"]);
    expect(fallbackChannels({ email: null, phone: "+12085550142", contact_pref: "email" }, true)).toEqual(["text"]);
    expect(fallbackChannels({ email: null, phone: "+12085550142", contact_pref: "text" }, false)).toEqual([]);
  });
});
