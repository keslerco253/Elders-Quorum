import { appUrl } from "./config";
import { emailHtml, sendMail } from "./mail";
import type { Member } from "./types";
import { getWard } from "./wards";

export async function sendLoginEmail(member: Member, token: string, code: string) {
  const ward = getWard(member.ward_id);
  const link = `${appUrl()}/auth/verify?token=${encodeURIComponent(token)}`;
  const appName = ward?.name ?? "Elders Quorum";
  const text = `Hi ${member.display_name},\n\nTap the button below to sign in to ${appName}.\n\nOr enter this code in the app: ${code}\n\nThe link and code expire in 20 minutes. If you didn't ask to sign in, you can ignore this email.`;
  return sendMail({
    to: member.email!,
    subject: `Your sign-in code: ${code}`,
    text: `${text}\n\n${link}`,
    html: emailHtml(`Sign in to ${appName}`, text, { url: link, label: "Sign in" }),
  });
}
