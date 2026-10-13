import { appUrl } from "./config";
import { emailHtml, sendMail } from "./mail";
import { sendSms } from "./sms";
import type { ContactKind } from "./contact";
import type { Member } from "./types";
import { getWard } from "./wards";

/** Sends a sign-in code to the phone number or email the member typed. */
export async function sendLoginCode(member: Member, via: ContactKind, token: string, code: string) {
  const ward = getWard(member.ward_id);
  const appName = ward?.name ?? "Elders Quorum";
  if (via === "phone" && member.phone) {
    const res = await sendSms(member.ward_id, member.phone, `${code} is your ${appName} sign-in code. It expires in 20 minutes. Reply STOP to opt out.`, "code");
    return res === "sent";
  }
  if (!member.email) return false;
  const link = `${appUrl()}/auth/verify?token=${encodeURIComponent(token)}`;
  const text = `Hi ${member.display_name},\n\nTap the button below to sign in to ${appName}.\n\nOr enter this code in the app: ${code}\n\nThe link and code expire in 20 minutes. If you didn't ask to sign in, you can ignore this email.`;
  return sendMail({
    to: member.email,
    subject: `Your sign-in code: ${code}`,
    text: `${text}\n\n${link}`,
    html: emailHtml(`Sign in to ${appName}`, text, { url: link, label: "Sign in" }),
  });
}

/**
 * An account message (like "you're approved") to the contact the member
 * signed up with. Sent even when the monthly text limit is reached.
 */
export async function sendAccountNotice(member: Member, subject: string, text: string, link: { url: string; label: string }) {
  if (member.email) {
    return sendMail({ to: member.email, subject, text: `${text}\n\n${link.url}`, html: emailHtml(subject, text, link) });
  }
  if (member.phone) {
    const ward = getWard(member.ward_id);
    return (await sendSms(member.ward_id, member.phone, `${ward?.name ?? "Elders Quorum"}: ${text.replace(/\s+/g, " ").replace(/^Hi [^,]+, /, "")} ${link.url}`, "code")) === "sent";
  }
  return false;
}
