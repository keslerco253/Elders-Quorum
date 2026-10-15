import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-rate-"));

describe("attempt limits", () => {
  beforeEach(async () => {
    (await import("@/lib/db")).useTestDb(`INSERT INTO wards (id, name) VALUES (1, 'W'); INSERT INTO members (id, ward_id, name, display_name, email, status, contact_pref) VALUES (1, 1, 'A', 'Alice', 'alice@test.local', 'active', 'email')`);
  });

  it("allows up to the limit per key, then refuses", async () => {
    const { allowHit, overLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < 3; i++) expect(allowHit("login:1.2.3.4", 3, 60)).toBe(true);
    expect(allowHit("login:1.2.3.4", 3, 60)).toBe(false);
    expect(overLimit("login:1.2.3.4", 3, 60)).toBe(true);
    expect(allowHit("login:5.6.7.8", 3, 60)).toBe(true);
  });

  it("stops guessing sign-in codes after 15 wrong tries in a day, even across new codes", async () => {
    const auth = await import("@/lib/auth-core");
    let right = "";
    for (let round = 0; round < 3; round++) {
      const t = auth.createLoginToken(1, "month");
      if (!t.ok) throw new Error("rate limited");
      right = t.code;
      for (let i = 0; i < 5; i++) expect(auth.redeemCode("alice@test.local", right === "000000" ? "000001" : "000000")).toBeNull();
    }
    const t = auth.createLoginToken(1, "month");
    if (!t.ok) throw new Error("rate limited");
    // Even the right code is refused until the day is up.
    expect(auth.redeemCode("alice@test.local", t.code)).toBeNull();
  });

  it("reads the visitor's address from the hosting's headers", async () => {
    const { clientIp } = await import("@/lib/rate-limit");
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" }))).toBe("9.9.9.9");
    process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
    expect(clientIp(new Headers({ "cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }))).toBe("8.8.8.8");
    delete process.env.CLIENT_IP_HEADER;
  });
});
