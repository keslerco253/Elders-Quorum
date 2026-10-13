import fs from "fs";
import path from "path";
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

/** Texts sent this calendar month (UTC) for a ward. */
export function textsThisMonth(wardId: number, kind?: "code" | "notice" | "reply"): number {
  const row = db()
    .prepare(`SELECT COUNT(*) AS n FROM sms_log WHERE ward_id = ? AND sent_at >= strftime('%Y-%m-01 00:00:00', 'now') ${kind ? "AND kind = ?" : ""}`)
    .get(...(kind ? [wardId, kind] : [wardId])) as { n: number };
  return row.n;
}

export function monthlyLimit(wardId: number): number {
  return (db().prepare("SELECT sms_monthly_limit AS n FROM wards WHERE id = ?").get(wardId) as { n: number } | undefined)?.n ?? 500;
}

/**
 * Notices stop at the monthly limit, which also counts texts members send back.
 * Sign-in codes are always sent so no one is locked out.
 */
export function canSendNotice(wardId: number) {
  return phoneEnabled() && textsThisMonth(wardId, "notice") + textsThisMonth(wardId, "reply") < monthlyLimit(wardId);
}

export type SmsResult = "sent" | "failed" | "opted_out";

export async function sendSms(wardId: number, to: string, body: string, kind: "code" | "notice"): Promise<SmsResult> {
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
  if (result === "sent") db().prepare("INSERT INTO sms_log (ward_id, kind) VALUES (?, ?)").run(wardId, kind);
  return result;
}
