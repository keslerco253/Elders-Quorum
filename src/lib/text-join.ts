import QRCode from "qrcode";
import { db } from "./db";
import { formatPhone } from "./contact";
import { SMS_DISCLOSURE, textingNumber } from "./sms";

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

/** The confirmation texted back after JOIN. */
export const joinConfirmation = (wardName: string) =>
  `${wardName}: you're signed up for ward texts. You'll get reminders and messages here, and you can reply to reach your leaders. ${SMS_DISCLOSURE}`;

/** "(208) 555-0100", or "" when texting isn't set up. */
export const textingNumberDisplay = () => (textingNumber() ? formatPhone(textingNumber()) : "");

/** A QR code that opens a text to the app's number with JOIN filled in. */
export function joinQrSvg(): Promise<string> {
  return QRCode.toString(`SMSTO:${textingNumber()}:${JOIN_WORD}`, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}
