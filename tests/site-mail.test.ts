import { describe, expect, it } from "vitest";

describe("the site's email account", () => {
  it("is the server's settings until the site owner sets one in the app, which is kept sealed", async () => {
    process.env.SMTP_USER = "villaseldersquorum@gmail.com";
    process.env.SMTP_PASS = "server-pass";
    process.env.MAIL_FROM_NAME = "Elders Quorum";
    const d = (await import("@/lib/db")).useTestDb();
    const mail = await import("@/lib/mail");
    expect(mail.siteMailInfo()).toEqual({ address: "villaseldersquorum@gmail.com", fromName: "Elders Quorum", host: "smtp.gmail.com", port: 465, source: "server" });
    mail.saveSiteMail("mywardlink@gmail.com", "abcdefghijklmnop", "My Ward Link");
    expect(mail.siteMailInfo()).toEqual({ address: "mywardlink@gmail.com", fromName: "My Ward Link", host: "smtp.gmail.com", port: 465, source: "app" });
    const raw = (d.prepare("SELECT value FROM app_settings WHERE key = 'site_mail'").get() as { value: string }).value;
    expect(raw).not.toContain("abcdefghijklmnop");
    expect(mail.savedSiteMailPassword()).toBe("abcdefghijklmnop");
    mail.renameSiteMail("Ward Link");
    expect(mail.siteMailInfo()?.fromName).toBe("Ward Link");
    expect(mail.savedSiteMailPassword()).toBe("abcdefghijklmnop");
    mail.clearSiteMail();
    expect(mail.siteMailInfo()?.source).toBe("server");
  });
});
