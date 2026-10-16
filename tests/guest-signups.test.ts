import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-guests-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

describe("signing up from a public link, without an account", () => {
  let d: import("better-sqlite3").Database;
  let g: typeof import("@/lib/guest-signups");
  let ps: typeof import("@/lib/public-shares");
  let slot: number;
  let signup: number;
  let token: string;
  const outbox = () => fs.readdirSync(path.join(dir, "outbox"));
  const lastTo = (who: string) => fs.readFileSync(path.join(dir, "outbox", outbox().filter((f) => f.includes(who)).sort().pop()!), "utf8");

  beforeEach(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@test.local', 'presidency');
    `);
    g = await import("@/lib/guest-signups");
    ps = await import("@/lib/public-shares");
    signup = Number(d.prepare("INSERT INTO signups (org_id, title, date) VALUES (1, 'Temple Cleaning', '2030-10-30')").run().lastInsertRowid);
    slot = Number(d.prepare("INSERT INTO signup_slots (signup_id, label, capacity) VALUES (?, 'Saturday 9 AM', 1)").run(signup).lastInsertRowid);
    token = ps.createShare({ orgId: 1, kind: "signup", signupId: signup, title: "Temple Cleaning", caption: "", createdBy: 1 });
  });

  it("confirms by emailed code, takes the spot, and can be cancelled", async () => {
    const id = (await g.startGuestSignup({ slotId: slot, name: "John Smith", contact: "john@test.local", kind: "email", note: "", textConsent: false }))!;
    expect(g.slotTaken(slot)).toBe(0);
    const code = lastTo("john@test.local").match(/is: (\d{6})/)![1];
    expect(g.confirmGuest(id, "000000" === code ? "111111" : "000000")).toBe("wrong");
    expect(g.confirmGuest(id, code)).toBe("ok");
    expect(g.slotTaken(slot)).toBe(1);
    expect(g.guestShortName("John Smith")).toBe("John S.");
    // The spot is full now: another guest can't confirm into it.
    const other = (await g.startGuestSignup({ slotId: slot, name: "Ann Lee", contact: "ann@test.local", kind: "email", note: "", textConsent: false }))!;
    expect(g.confirmGuest(other, lastTo("ann@test.local").match(/is: (\d{6})/)![1])).toBe("full");
    await g.sendGuestConfirmation(id, token);
    expect(lastTo("john@test.local")).toContain(`/p/${token}/cancel?g=${id}`);
    const cancelToken = (d.prepare("SELECT cancel_token FROM signup_guests WHERE id = ?").get(id) as { cancel_token: string }).cancel_token;
    expect(g.cancelGuest(id, "wrong")).toBe(false);
    expect(g.cancelGuest(id, cancelToken)).toBe(true);
    expect(g.slotTaken(slot)).toBe(0);
  });

  it("never texts a phone number unless they agreed, and STOP ends it", async () => {
    expect(await g.startGuestSignup({ slotId: slot, name: "Tex", contact: "+12085550188", kind: "phone", note: "", textConsent: false })).toBeNull();
    expect(outbox().some((f) => f.includes("12085550188"))).toBe(false);
    const id = (await g.startGuestSignup({ slotId: slot, name: "Tex", contact: "+12085550188", kind: "phone", note: "", textConsent: true }))!;
    const row = d.prepare("SELECT sms_consent_at, consent_text FROM signup_guests WHERE id = ?").get(id) as { sms_consent_at: string; consent_text: string };
    expect(row.sms_consent_at).toBeTruthy();
    expect(row.consent_text).toBe(g.GUEST_TEXT_CONSENT);
    expect(lastTo("12085550188")).toMatch(/\d{6} is your code/);
    expect(g.guestOptOut("+12085550188")).toBe(1);
  });

  it("is reminded on the opportunity's reminder days, by email when they didn't agree to texts", async () => {
    const id = (await g.startGuestSignup({ slotId: slot, name: "John Smith", contact: "john@test.local", kind: "email", note: "", textConsent: false }))!;
    g.confirmGuest(id, lastTo("john@test.local").match(/is: (\d{6})/)![1]);
    // A day before (the default second reminder), at 9 AM in Boise.
    const due = g.guestRemindersDue(new Date("2030-10-29T15:00:00Z"));
    expect(due.map((r) => [r.when, r.texts])).toEqual([["tomorrow", false]]);
    await g.sendGuestReminder(due[0]);
    expect(lastTo("john@test.local")).toContain("Reminder: you signed up for Temple Cleaning (Saturday 9 AM) tomorrow");
  });
});
