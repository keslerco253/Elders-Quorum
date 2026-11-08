import QRCode from "qrcode";
import { db } from "./db";
import { formatPhone } from "./contact";
import { SMS_DISCLOSURE, textingNumber } from "./sms";
import { appUrl } from "./config";

// Members who don't use the app can still get ward texts: a leader adds them with
// their mobile number, and they text JOIN to the app's number. That text is their own
// agreement (what carriers require), so from then on everything comes to them by text,
// and their texted replies reach their leaders.

export const JOIN_WORD = "JOIN";

/** Texted back to a number that isn't anyone's yet. */
export const JOIN_UNKNOWN_REPLY =
  "My Ward Link: we don't have this number yet. Please ask your ward leaders to add you with this mobile number, then text JOIN again.";

/**
 * Everyone active with this number agrees to ward texts (a couple sharing a phone both
 * hear), getting every reminder and message by text. Returns their names, or none.
 */
export function joinByText(phone: string): string[] {
  const d = db();
  const people = d.prepare("SELECT id, display_name FROM members WHERE phone = ? AND status = 'active'").all(phone) as { id: number; display_name: string }[];
  d.prepare(
    `UPDATE members SET sms_consent_at = coalesce(sms_consent_at, datetime('now')), sms_consent_via = CASE WHEN sms_consent_at IS NULL THEN 'text' ELSE sms_consent_via END,
       text_consent_pending = 0, always_text = 1,
       contact_pref = CASE contact_pref WHEN 'none' THEN 'text' WHEN 'email' THEN 'both' ELSE contact_pref END
     WHERE phone = ? AND status = 'active'`,
  ).run(phone);
  return people.map((p) => p.display_name);
}

/** The names on active accounts with this number already signed up for ward texts (none: not yet). */
export function alreadyJoined(phone: string): string[] {
  const rows = db().prepare("SELECT display_name FROM members WHERE phone = ? AND status = 'active' AND sms_consent_at IS NOT NULL ORDER BY display_name").all(phone) as { display_name: string }[];
  return rows.map((r) => r.display_name);
}

/** The sign-in page with their number filled in. */
export const loginLink = (phone: string) => `${appUrl()}/login?contact=${encodeURIComponent(phone.replace(/^\+1(?=\d{10}$)/, ""))}`;

/** Texted back to JOIN from someone already signed up: which account, and where to sign in. */
export function alreadyJoinedReply(phone: string, names: string[], wardName: string): string {
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return `${wardName}: you're already signed up. This number is on ${names.length > 1 ? "the accounts for" : "the account for"} ${who}, and you get ward texts here. To use the app, sign in with this number: ${loginLink(phone)}`;
}

/** The confirmation texted back after JOIN. */
export const joinConfirmation = (wardName: string) =>
  `${wardName}: you're signed up for ward texts. You'll get reminders and messages here, and you can reply to reach your leaders. ${SMS_DISCLOSURE}`;

/** "(208) 555-0100", or "" when texting isn't set up. */
export const textingNumberDisplay = () => (textingNumber() ? formatPhone(textingNumber()) : "");

/** What a texting card says to text: JOIN and the ward's join code (so the app knows the ward), or just JOIN. */
export const joinText = (joinCode: string | null) => (joinCode ? `${JOIN_WORD} ${joinCode.toUpperCase()}` : JOIN_WORD);

/** A QR code that opens a text to the app's number with JOIN (and the join code) filled in. */
export function joinQrSvg(text = JOIN_WORD): Promise<string> {
  return QRCode.toString(`SMSTO:${textingNumber()}:${text}`, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}

// ---------------------------------------------------------------------------
// Joining by text from a number no one has added yet: they text JOIN (or JOIN and
// the ward's join code), and the app asks, one text at a time, for the join code (only
// when its number serves more than one ward), their name, and their organizations.
// Then their account is made, signed up for ward texts (their JOIN text is their
// agreement), and they show on the ward's New members list for its administrators to
// check.

interface TextJoin {
  phone: string;
  ward_id: number | null;
  step: "code" | "name" | "orgs";
  name: string;
  attempts: number;
}

/** A conversation left this long is forgotten (they start again with JOIN). */
const JOIN_MINUTES = 60;

/** Wards that take members by text: texting on, approved, not the reviewers' demo. */
function textingWards(): { id: number; name: string }[] {
  return db().prepare("SELECT id, name FROM wards WHERE texting_enabled = 1 AND no_texting = 0 AND pending = 0 AND demo = 0 ORDER BY id").all() as { id: number; name: string }[];
}

function wardForCode(code: string): { id: number; name: string } | undefined {
  const c = code.trim();
  if (!c) return undefined;
  return db().prepare("SELECT id, name FROM wards WHERE join_code = ? COLLATE NOCASE AND pending = 0 AND no_texting = 0 AND demo = 0").get(c) as { id: number; name: string } | undefined;
}

/** The organizations someone can choose (by number) when joining by text. */
function joinableOrgs(wardId: number): { id: number; name: string }[] {
  return db().prepare("SELECT id, name FROM orgs WHERE ward_id = ? AND kind = 'group' AND active = 1 ORDER BY name COLLATE NOCASE").all(wardId) as { id: number; name: string }[];
}

function joinRow(phone: string): TextJoin | undefined {
  return db().prepare(`SELECT * FROM text_joins WHERE phone = ? AND updated_at > datetime('now', '-${JOIN_MINUTES} minutes')`).get(phone) as TextJoin | undefined;
}

function setStep(phone: string, step: TextJoin["step"], wardId: number | null, name = "") {
  db()
    .prepare("INSERT INTO text_joins (phone, ward_id, step, name, attempts, updated_at) VALUES (?, ?, ?, ?, 0, datetime('now')) ON CONFLICT(phone) DO UPDATE SET ward_id = excluded.ward_id, step = excluded.step, name = excluded.name, attempts = 0, updated_at = excluded.updated_at")
    .run(phone, wardId, step, name);
}

/** Ends a number's join conversation (they joined, or replied STOP). */
export function endTextJoin(phone: string) {
  db().prepare("DELETE FROM text_joins WHERE phone = ?").run(phone);
}

/** Whether this number is partway through joining by text. */
export const inTextJoin = (phone: string) => !!joinRow(phone);

const askName = (ward: string) => `Welcome to ${ward} on My Ward Link! What's your first and last name? Reply with just your name.`;
const ASK_CODE = "Welcome to My Ward Link! What's your ward's join code? Your bishopric or an organization presidency has it.";

/** JOIN (optionally followed by a join code) from a number no one has added. Returns the reply. */
export function startTextJoin(phone: string, rest: string): string {
  const ward = wardForCode(rest);
  if (ward) {
    setStep(phone, "name", ward.id);
    return askName(ward.name);
  }
  const wards = textingWards();
  if (wards.length === 1 && !rest.trim()) {
    setStep(phone, "name", wards[0].id);
    return askName(wards[0].name);
  }
  if (!wards.length && !rest.trim()) return JOIN_UNKNOWN_REPLY;
  setStep(phone, "code", null);
  return rest.trim() ? `That join code didn't match. ${ASK_CODE}` : ASK_CODE;
}

/** "jane smith" stays as typed; one that isn't a name (a word like YES, a number, a link) isn't taken. */
function cleanName(body: string): string | null {
  const name = body.replace(/\s+/g, " ").trim().slice(0, 80);
  if (name.length < 2 || !/\p{L}/u.test(name) || /https?:|www\.|@|\d{3}/i.test(name)) return null;
  if (/^(yes|no|ok|okay|help|info|stop|join|start|hi|hello)$/i.test(name)) return null;
  return name;
}

/** The next text in a number's join conversation. Returns the reply. */
export function continueTextJoin(phone: string, body: string): string {
  const row = joinRow(phone);
  if (!row) return JOIN_UNKNOWN_REPLY;
  const d = db();
  const tried = () => d.prepare("UPDATE text_joins SET attempts = attempts + 1, updated_at = datetime('now') WHERE phone = ?").run(phone);
  if (row.step === "code") {
    const ward = wardForCode(body);
    if (!ward) {
      if (row.attempts >= 4) {
        endTextJoin(phone);
        return "That join code didn't match. Please check it with your ward leaders, then text JOIN again.";
      }
      tried();
      return "That join code didn't match. Please check it and reply with just the code.";
    }
    setStep(phone, "name", ward.id);
    return askName(ward.name);
  }
  const wardId = row.ward_id;
  const ward = wardId ? (d.prepare("SELECT name FROM wards WHERE id = ?").get(wardId) as { name: string } | undefined) : undefined;
  if (!wardId || !ward) {
    endTextJoin(phone);
    return JOIN_UNKNOWN_REPLY;
  }
  if (row.step === "name") {
    const name = cleanName(body);
    if (!name) {
      if (row.attempts >= 4) {
        endTextJoin(phone);
        return "Please ask your ward leaders to add you, or text JOIN to start again.";
      }
      tried();
      return "Please reply with your first and last name.";
    }
    const orgs = joinableOrgs(wardId);
    if (!orgs.length) return finishTextJoin(phone, wardId, ward.name, name, []);
    setStep(phone, "orgs", wardId, name);
    return `Thanks, ${name.split(" ")[0]}! Which are you part of? Reply with the numbers (like 1 or 1 3), or NONE:\n${orgs.map((o, i) => `${i + 1} ${o.name}`).join("\n")}`;
  }
  // Which organizations (by number), or none.
  const orgs = joinableOrgs(wardId);
  const picks = [...new Set((body.match(/\d+/g) ?? []).map(Number))].filter((n) => n >= 1 && n <= orgs.length);
  if (!picks.length && !/^\s*(none|no|skip|0)\b/i.test(body)) {
    if (row.attempts >= 3) return finishTextJoin(phone, wardId, ward.name, row.name, []);
    tried();
    return `Please reply with the numbers of the ones you're part of (like 1 or 1 3), or NONE:\n${orgs.map((o, i) => `${i + 1} ${o.name}`).join("\n")}`;
  }
  return finishTextJoin(
    phone,
    wardId,
    ward.name,
    row.name,
    picks.map((n) => orgs[n - 1].id),
  );
}

/** Makes their account in the ward (and the organizations chosen), signed up for ward texts. */
function finishTextJoin(phone: string, wardId: number, wardName: string, name: string, orgIds: number[]): string {
  const d = db();
  d.transaction(() => {
    // Someone added this number meanwhile: join them instead of making another account.
    const existing = d.prepare("SELECT id FROM members WHERE phone = ? AND status = 'active' LIMIT 1").get(phone) as { id: number } | undefined;
    const memberId =
      existing?.id ??
      Number(
        d
          .prepare(
            `INSERT INTO members (name, display_name, phone, contact_pref, status, source, always_text, sms_consent_at, sms_consent_via)
             VALUES (?, ?, ?, 'text', 'active', 'request', 1, datetime('now'), 'join-text')`,
          )
          .run(name, name, phone).lastInsertRowid,
      );
    d.prepare("INSERT OR IGNORE INTO ward_members (ward_id, member_id) VALUES (?, ?)").run(wardId, memberId);
    const wardOrg = d.prepare("SELECT id FROM orgs WHERE ward_id = ? AND kind = 'ward'").get(wardId) as { id: number } | undefined;
    for (const orgId of [...(wardOrg ? [wardOrg.id] : []), ...orgIds]) d.prepare("INSERT OR IGNORE INTO org_members (org_id, member_id, official, notify) VALUES (?, ?, 1, 1)").run(orgId, memberId);
  })();
  joinByText(phone);
  endTextJoin(phone);
  return `${joinConfirmation(wardName)} To use the app too, sign in with this number: ${loginLink(phone)}`;
}
