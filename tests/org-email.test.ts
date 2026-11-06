import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, useTestDb } from "@/lib/db";

const sent: { from: unknown; to: string }[] = [];
vi.mock("nodemailer", () => ({
  default: {
    createTransport: (opts: { auth?: { user: string } }) => ({
      sendMail: async (m: { from: unknown; to: string }) => {
        if (opts.auth?.user === "broken@gmail.com")
          throw new Error("Invalid login");
        sent.push({ from: m.from, to: m.to });
      },
      verify: async () => true,
      close: () => {},
    }),
  },
}));

describe("organization email accounts", () => {
  beforeEach(() => {
    sent.length = 0;
    process.env.SMTP_USER = "site@gmail.com";
    process.env.SMTP_PASS = "x";
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
    `);
  });

  async function setup() {
    const { sealSecret } = await import("@/lib/secret-box");
    const d = db();
    // A new ward (not using the site's email), with the elders quorum and the ward.
    const eq = (
      d
        .prepare("SELECT id FROM orgs WHERE ward_id = 1 AND kind <> 'ward'")
        .get() as { id: number }
    ).id;
    const ward = (
      d
        .prepare("SELECT id FROM orgs WHERE ward_id = 1 AND kind = 'ward'")
        .get() as { id: number }
    ).id;
    const add = (org: number, address: string) =>
      d
        .prepare(
          "INSERT INTO org_mail (org_id, address, secret) VALUES (?, ?, ?)",
        )
        .run(org, address, sealSecret("app-password"));
    return { eq, ward, add, d };
  }

  it("sends from the organization's account, else the ward's, else the site's only where allowed", async () => {
    const { sendMail, mailRoute } = await import("@/lib/mail");
    const { eq, ward, add, d } = await setup();
    // Here before ward email accounts: the site's email.
    expect(mailRoute(eq)).toEqual(["site"]);
    // A ward that doesn't use the site's email sends none until it connects one.
    d.prepare("UPDATE wards SET site_email = 0").run();
    expect(mailRoute(eq)).toEqual([]);
    expect(
      await sendMail({ to: "m@x.com", subject: "s", text: "t", orgId: eq }),
    ).toBe(false);
    // ...except sign-in codes its leaders need.
    expect(mailRoute(eq, true)).toEqual(["site"]);
    add(ward, "villasward@gmail.com");
    expect(
      await sendMail({ to: "m@x.com", subject: "s", text: "t", orgId: eq }),
    ).toBe(true);
    expect(sent.at(-1)).toMatchObject({
      from: { name: "Villas Ward", address: "villasward@gmail.com" },
    });
    add(eq, "villaseq@gmail.com");
    expect(
      await sendMail({ to: "m@x.com", subject: "s", text: "t", orgId: eq }),
    ).toBe(true);
    expect(sent.at(-1)).toMatchObject({
      from: { address: "villaseq@gmail.com" },
    });
    // The ward's own email still comes from the ward's account.
    expect(
      await sendMail({ to: "m@x.com", subject: "s", text: "t", orgId: ward }),
    ).toBe(true);
    expect(sent.at(-1)).toMatchObject({
      from: { address: "villasward@gmail.com" },
    });
  });

  it("falls back to the ward's account when the organization's fails or is used up for the day", async () => {
    const { sendMail, DAILY_LIMIT } = await import("@/lib/mail");
    const { eq, ward, add, d } = await setup();
    d.prepare("UPDATE wards SET site_email = 0").run();
    add(ward, "villasward@gmail.com");
    add(eq, "broken@gmail.com");
    expect(
      await sendMail({ to: "m@x.com", subject: "s", text: "t", orgId: eq }),
    ).toBe(true);
    expect(sent.at(-1)).toMatchObject({
      from: { address: "villasward@gmail.com" },
    });
    expect(
      (
        d
          .prepare("SELECT last_error FROM org_mail WHERE org_id = ?")
          .get(eq) as { last_error: string }
      ).last_error,
    ).toContain("Invalid login");
    d.prepare(
      "UPDATE org_mail SET address = 'villaseq@gmail.com', sent_day = ?, sent_count = ?, updated_at = datetime('now', '+1 minute') WHERE org_id = ?",
    ).run(new Date().toISOString().slice(0, 10), DAILY_LIMIT, eq);
    expect(
      await sendMail({ to: "m@x.com", subject: "s", text: "t", orgId: eq }),
    ).toBe(true);
    expect(sent.at(-1)).toMatchObject({
      from: { address: "villasward@gmail.com" },
    });
  });

  it("keeps the app password sealed", async () => {
    const { sealSecret, openSecret } = await import("@/lib/secret-box");
    const sealed = sealSecret("abcd efgh ijkl mnop");
    expect(sealed).not.toContain("abcd");
    expect(openSecret(sealed)).toBe("abcd efgh ijkl mnop");
    expect(openSecret("garbage")).toBeNull();
  });
});
