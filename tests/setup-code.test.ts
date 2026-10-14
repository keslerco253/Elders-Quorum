import { describe, expect, it } from "vitest";

describe("setup code", () => {
  it("ignores capitals, spaces and quotes", async () => {
    const { setupCodeMatches } = await import("@/lib/setup-code");
    process.env.SETUP_CODE = ' "villas quorum 2026" ';
    expect(setupCodeMatches("Villas quorum 2026 ")).toBe(true);
    expect(setupCodeMatches("villas quorum")).toBe(false);
    process.env.SETUP_CODE = "";
    expect(setupCodeMatches("")).toBe(false);
  });
});

describe("app address", () => {
  it("adds https:// when the setting leaves it out", async () => {
    const { appUrl } = await import("@/lib/config");
    process.env.APP_URL = "mywardlink.net/";
    expect(appUrl()).toBe("https://mywardlink.net");
    process.env.APP_URL = "https://mywardlink.net";
    expect(appUrl()).toBe("https://mywardlink.net");
    process.env.APP_URL = "";
    expect(appUrl()).toBe("http://localhost:3000");
  });
});
