import { describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { createLoginToken, markCodeSent, redeemCode } from "@/lib/auth-core";

describe("joining is confirmed by the sign-in code", () => {
  it("counts agreeing to texts only once a texted code is used, and joins an existing account to the ward then", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise'), (2, 'Second', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role) VALUES (5, 1, 'S', 'Sam', 's@x.com', '+12085550199', 'member');
    `);
    const d = db();
    d.prepare("UPDATE members SET text_consent_pending = 1, pending_join_ward = 2, sms_consent_at = NULL WHERE id = 5").run();
    const consent = () => (d.prepare("SELECT sms_consent_at FROM members WHERE id = 5").get() as { sms_consent_at: string | null }).sms_consent_at;
    const inSecond = () => !!d.prepare("SELECT 1 FROM ward_members WHERE member_id = 5 AND ward_id = 2").get();
    expect(inSecond()).toBe(false);

    // A code emailed to them joins the ward but isn't consent to texts.
    const byEmail = createLoginToken(5, "month");
    if (!byEmail.ok) throw new Error("no token");
    markCodeSent(byEmail.token, "email");
    expect(redeemCode("s@x.com", byEmail.code)).not.toBeNull();
    expect(inSecond()).toBe(true);
    expect(consent()).toBeNull();

    const byText = createLoginToken(5, "month");
    if (!byText.ok) throw new Error("no token");
    markCodeSent(byText.token, "phone");
    expect(redeemCode("+12085550199", byText.code)?.sentVia).toBe("phone");
    expect(consent()).not.toBeNull();
  });
});
