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
/** The number members text (JOIN, replies): the app's Twilio number (a sample one for testing without Twilio). */
export const textingNumber = () => FROM() || (process.env.SMS_DEV_OUTBOX === "1" ? "+12085550100" : "");

export const SMS_DISCLOSURE = "Msg freq varies. Msg&data rates may apply. Reply HELP for help, STOP to opt out.";

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

const wardOfOrg = (orgId: number) =>
  (db().prepare("SELECT o.ward_id, w.texting_enabled, w.no_texting FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE o.id = ?").get(orgId) as
    | { ward_id: number; texting_enabled: number; no_texting: number }
    | undefined) ?? {
    ward_id: 0,
    texting_enabled: 0,
    no_texting: 0,
  };

/** A ward set to no texting at all: no texts, not even sign-in codes (it uses email). */
export const orgHasNoTexting = (orgId: number | null) => !!orgId && !!wardOfOrg(orgId).no_texting;

/** Whether a member can be texted at all: they're in at least one ward that allows texting. */
export function memberTextable(memberId: number): boolean {
  return !!db().prepare("SELECT 1 FROM ward_members wm JOIN wards w ON w.id = wm.ward_id WHERE wm.member_id = ? AND w.no_texting = 0").get(memberId);
}

/** Whether a ward (by its join code) allows texting. Unknown codes count as allowing it. */
export function joinCodeAllowsTexting(code: string | undefined): boolean {
  if (!code) return true;
  const w = db().prepare("SELECT no_texting FROM wards WHERE join_code = ? COLLATE NOCASE").get(code.trim()) as { no_texting: number } | undefined;
  return !w?.no_texting;
}

// What texting costs, to bill wards their share (Admin → Site owner).

/** The cost of one text in dollars (site owner's setting; Twilio plus carrier fees). */
export function textCost(): number {
  const v = (db().prepare("SELECT value FROM app_settings WHERE key = 'text_cost'").get() as { value: string } | undefined)?.value;
  const n = Number(v);
  return v && Number.isFinite(n) && n >= 0 ? n : 0.012;
}

export function setTextCost(dollars: number) {
  db().prepare("INSERT INTO app_settings (key, value) VALUES ('text_cost', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(dollars));
}

/** A ward's texts by month (yyyy-mm), newest first, up to 12 months: codes, notices and replies together. */
/** Segments billed this month (what the cost is counted from). */
export function segmentsThisMonth(wardId: number): number {
  return (
    db()
      .prepare(`SELECT coalesce(SUM(l.segments), 0) AS n FROM sms_log l JOIN orgs o ON o.id = l.org_id WHERE o.ward_id = ? AND l.sent_at >= strftime('%Y-%m-01 00:00:00', 'now')`)
      .get(wardId) as { n: number }
  ).n;
}

export function textsByMonth(wardId: number): { month: string; texts: number; segments: number }[] {
  return db()
    .prepare(
      `SELECT substr(l.sent_at, 1, 7) AS month, COUNT(*) AS texts, coalesce(SUM(l.segments), 0) AS segments FROM sms_log l JOIN orgs o ON o.id = l.org_id
       WHERE o.ward_id = ? AND l.sent_at >= date('now', 'start of month', '-11 months') GROUP BY month ORDER BY month DESC`,
    )
    .all(wardId) as { month: string; texts: number; segments: number }[];
}

/**
 * Notices stop at the ward's monthly limit, which also counts texts members
 * send back, and aren't sent at all for wards the site owner hasn't turned
 * texting on for. Sign-in codes are always sent so no one is locked out.
 */
export function canSendNotice(orgId: number) {
  const w = wardOfOrg(orgId);
  return phoneEnabled() && !w.no_texting && !!w.texting_enabled && textsThisMonth(w.ward_id, "notice") + textsThisMonth(w.ward_id, "reply") < monthlyLimit(w.ward_id);
}

/**
 * Last line of a code text, like "@mywardlink.net #123456". iPhones and
 * Android phones then offer the code above the keyboard (or fill it in) on
 * the app's own sign-in page, and nowhere else.
 */
export function codeTextFooter(code: string) {
  const host = new URL(appUrl()).hostname;
  return host === "localhost" ? "" : `\n@${host} #${code}`;
}

export type SmsResult = "sent" | "failed" | "opted_out";

/** Sends a text; orgId is the organization it's for (counted against its ward's limit). */
export async function sendSms(orgId: number | null, to: string, text: string, kind: "code" | "notice"): Promise<SmsResult> {
  if (!phoneEnabled() || orgHasNoTexting(orgId)) return "failed";
  // In the plain alphabet, so it's billed at 153 letters a segment, not 67.
  const body = toGsm7(text);
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
  if (result === "sent" && orgId) db().prepare("INSERT INTO sms_log (org_id, kind, segments) VALUES (?, ?, ?)").run(orgId, kind, smsSegments(body));
  return result;
}

/** People who sign in with only a phone number and are in no other ward that allows texting (they'd need an email first). */
export function phoneOnlyMembers(wardId: number): number {
  return (
    db()
      .prepare(
        `SELECT COUNT(*) AS n FROM members m JOIN ward_members wm ON wm.member_id = m.id AND wm.ward_id = ?
         WHERE m.email IS NULL AND m.phone IS NOT NULL AND m.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM ward_members x JOIN wards w ON w.id = x.ward_id WHERE x.member_id = m.id AND w.id <> ? AND w.no_texting = 0)`,
      )
      .get(wardId, wardId) as { n: number }
  ).n;
}

// Texts are billed by the segment: 153 characters each in the plain text alphabet
// (GSM-7), but only 67 once any other character appears (a curly quote, an arrow, an
// emoji), which can make the same text cost 3 times as much. So every text is put in
// the plain alphabet before it's sent.

const GSM7 = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
/** Characters that count as two in GSM-7. */
const GSM7_EXT = new Set("^{}\\[~]|€");

const SWAPS: [RegExp, string][] = [
  [/[\u2018\u2019\u201A\u201B\u2032\u0060\u00B4]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"'],
  [/[\u2010-\u2015\u2212]/g, "-"],
  [/\u2026/g, "..."],
  [/[\u2192\u27A1\u21D2]/g, "->"],
  [/[\u2190]/g, "<-"],
  [/[\u2022\u00B7\u25CF]/g, "-"],
  [/[\u00A0\u2007\u202F\u2009\u200A]/g, " "],
  [/[\u200B-\u200D\u2060\uFE0F]/g, ""],
  [/\u2713|\u2714/g, ""],
];

/** The text in the plain text alphabet: straight quotes, -> for arrows, no emoji, plain letters. */
export function toGsm7(text: string): string {
  let t = text;
  for (const [re, to] of SWAPS) t = t.replace(re, to);
  // Quotes doubled up by quoting a title that already had them: ""Title"" -> "Title".
  t = t.replace(/"{2,}/g, '"').replace(/'{2,}/g, "'");
  let out = "";
  for (const ch of t) {
    if (GSM7.has(ch) || GSM7_EXT.has(ch)) out += ch;
    else {
      // Accented letters without a plain-alphabet version lose the accent (í -> i).
      const plain = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (plain.length && [...plain].every((c) => GSM7.has(c))) out += plain;
      // Anything else (emoji, symbols) is dropped.
    }
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

/** How many segments a (plain-alphabet) text is billed as. */
export function smsSegments(text: string): number {
  const units = [...text].reduce((n, c) => n + (GSM7_EXT.has(c) ? 2 : 1), 0);
  return units <= 160 ? 1 : Math.ceil(units / 153);
}
