import { beforeAll, describe, expect, it } from "vitest";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-webhook-"));
process.env.APP_URL = "https://mywardlink.net";
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_AUTH_TOKEN = "secret-token";
process.env.TWILIO_FROM = "+12083579951";

/** A request signed the way Twilio signs it, for the address Twilio is set to. */
function twilioRequest(twilioUrl: string, params: Record<string, string>, opts: { token?: string; host?: string } = {}) {
  const data = twilioUrl + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const signature = crypto.createHmac("sha1", opts.token ?? "secret-token").update(data, "utf8").digest("base64");
  // Behind the hosting proxy the app sees an internal address; the public one is in the forwarded headers.
  return new Request("http://0.0.0.0:3000/api/sms/inbound", {
    method: "POST",
    headers: { "x-twilio-signature": signature, "x-forwarded-host": opts.host ?? "mywardlink.net", "x-forwarded-proto": "https" },
    body: new URLSearchParams(params),
  });
}

describe("Twilio's incoming-text webhook", () => {
  let d: import("better-sqlite3").Database;
  let POST: typeof import("@/app/api/sms/inbound/route").POST;
  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb();
    POST = (await import("@/app/api/sms/inbound/route")).POST;
  });
  const log = () => d.prepare("SELECT result, note FROM sms_inbound_log ORDER BY id DESC LIMIT 1").get() as { result: string; note: string };

  it("accepts texts signed for the app's address, with or without www or a trailing slash", async () => {
    const params = { From: "+12085550111", Body: "hello", To: "+12083579951" };
    expect((await POST(twilioRequest("https://mywardlink.net/api/sms/inbound", params))).status).toBe(200);
    expect((await POST(twilioRequest("https://www.mywardlink.net/api/sms/inbound", params, { host: "www.mywardlink.net" }))).status).toBe(200);
    expect((await POST(twilioRequest("https://mywardlink.net/api/sms/inbound/", params))).status).toBe(200);
    expect(log().result).toBe("unknown_sender");
  });

  it("refuses texts not signed by this Twilio account, and logs them for the site owner", async () => {
    const res = await POST(twilioRequest("https://mywardlink.net/api/sms/inbound", { From: "+12085550111", Body: "hi" }, { token: "wrong" }));
    expect(res.status).toBe(403);
    expect(log()).toMatchObject({ result: "rejected" });
    expect(log().note).toContain("https://mywardlink.net/api/sms/inbound");
  });
});
