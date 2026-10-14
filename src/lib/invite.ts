import QRCode from "qrcode";
import { firstName } from "./names";
import { appUrl } from "./config";
import { emailHtml, sendMail } from "./mail";
import type { Member } from "./types";

export const joinLink = (code: string) => `${appUrl()}/join?code=${encodeURIComponent(code)}`;

/** An SVG QR code that opens the join page with the code already filled in. */
export async function joinQrSvg(code: string) {
  return QRCode.toString(joinLink(code), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1d3a5f", light: "#ffffff" } });
}

/** Where an added member signs in, with their phone or email already filled in. */
export function inviteLink(m: Pick<Member, "email" | "phone">) {
  // US numbers without "+1" keep the link readable; the sign-in page adds it back.
  const contact = m.phone?.replace(/^\+1(?=\d{10}$)/, "") ?? m.email ?? "";
  return `${appUrl()}/login?contact=${encodeURIComponent(contact)}`;
}

/**
 * A personal invite a presidency member texts from their own phone. The app
 * itself never texts someone before they agree to texts.
 */
export function inviteText(m: Pick<Member, "display_name" | "email" | "phone">, appName: string) {
  const first = firstName(m.display_name);
  return `Hi ${first}! I added you to the ${appName} app for reminders, sign-ups and ward news. Sign in here with this phone number and you'll get a code: ${inviteLink(m)}`;
}

export async function sendInviteEmail(m: Pick<Member, "display_name" | "email" | "phone">, appName: string, from: string) {
  if (!m.email) return false;
  const link = inviteLink(m);
  const text = `Hi ${m.display_name},\n\n${from} added you to ${appName}, our ward app for reminders, sign-ups, the calendar and news from the ward and its organizations.\n\nSign in with this email address (${m.email}). We'll send you a code; no password needed.`;
  return sendMail({
    to: m.email,
    subject: `You're invited to ${appName}`,
    text: `${text}\n\n${link}`,
    html: emailHtml(`You're invited to ${appName}`, text, { url: link, label: "Sign in" }),
  });
}
