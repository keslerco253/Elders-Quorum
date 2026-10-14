import fs from "fs";
import path from "path";
import { appUrl } from "./config";
import { db, DATA_DIR } from "./db";

const SID = () => process.env.TWILIO_ACCOUNT_SID || "";
const TOKEN = () => process.env.TWILIO_AUTH_TOKEN || "";
const FROM = () => process.env.TWILIO_FROM || "";

/** Real texting through Twilio. */
export const twilioConfigured = () => !!(SID() && TOKEN() && FROM());

/**
 * Phone sign-in is offered only once texting works. SMS_DEV_OUTBOX=1 turns it on
 * without Twilio for testing: texts are written to data/outbox instead.
 */
export const phoneEnabled = () => twilioConfigured() || process.env.SMS_DEV_OUTBOX === "1";

/**
 * While carriers review the texting registration (SMS_PENDING=1), the join and
 * sign-in pages already show the mobile-number option and consent wording, so
 * reviewers can see how members opt in. Phone numbers aren't accepted yet.
 */
export const phoneOptInVisible = () => phoneEnabled() || process.env.SMS_PENDING === "1";

/** Full opt-in disclosure, sent with a member's first text. */
export const SMS_DISCLOSURE = "Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.";

/** Texts sent this calendar month (UTC) for a ward, all its organizations together. */
export function textsThisMonth(wardId: number, kind?: "code" | "notice" | "reply"): number {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS n FROM sms_log l JOIN orgs o ON o.id = l.org_id
       WHERE o.ward_id = ? AND l.sent_at >= strftime('%Y-%m-01 00:00:00', 'now') ${kind ? "AND l.kind = ?" : ""}`,
    )
    .get(...(kind ? [wardId, kind] : [wardId])) as { n: number };
  return row.n;
}

export function monthlyLimit(wardId: number): number {
  return (db().prepare("SELECT sms_monthly_limit AS n FROM wards WHERE id = ?").get(wardId) as { n: number } | undefined)?.n ?? 500;
}

const wardOfOrg = (orgId: number) => (db().prepare("SELECT ward_id FROM orgs WHERE id = ?").get(orgId) as { ward_id: number } | undefined)?.ward_id ?? 0;

/**
 * Notices stop at the ward's monthly limit, which also counts texts members
 * send back. Sign-in codes are always sent so no one is locked out.
 */
export function canSendNotice(orgId: number) {
  const wardId = wardOfOrg(orgId);
  return phoneEnabled() && textsThisMonth(wardId, "notice") + textsThisMonth(wardId, "reply") < monthlyLimit(wardId);
}

/**
 * Last line of a code text, like "@mywardlink.net #123456". iPhones and
 * Android phones then offer the code above the keyboard (or fill it in) on
 * the app's own sign-in page, and nowhere else.
 */
export function codeTextFooter(code: string) {
  const host = new URL(appUrl()).hostname;
  return host === "localhost" ? "" : `\n\n@${host} #${code}`;
}

export type SmsResult = "sent" | "failed" | "opted_out";

/** Sends a text; orgId is the organization it's for (counted against its ward's limit). */
export async function sendSms(orgId: number | null, to: string, body: string, kind: "code" | "notice"): Promise<SmsResult> {
  if (!phoneEnabled()) return "failed";
  let result: SmsResult = "sent";
  if (!twilioConfigured()) {
    const dir = path.join(DATA_DIR, "outbox");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${Date.now()}-sms-${to.replace(/\D/g, "")}.txt`), `SMS To: ${to}\n\n${body}\n`);
  } else {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID()}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: "Basic " + Buffer.from(`${SID()}:${TOKEN()}`).toString("base64"),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: FROM(), Body: body }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
        // 21610: the person replied STOP to our number.
        result = err.code === 21610 ? "opted_out" : "failed";
        console.error("[sms] send failed", res.status, err.code, err.message);
      }
    } catch (err) {
      console.error("[sms] send failed", (err as Error).message);
      result = "failed";
    }
  }
  if (result === "sent" && orgId) db().prepare("INSERT INTO sms_log (org_id, kind) VALUES (?, ?)").run(orgId, kind);
  return result;
}
