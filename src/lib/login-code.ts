import { appUrl } from "./config";
import { canEmail, emailHtml, sendMail } from "./mail";
import { db } from "./db";
import { codeTextFooter, sendSms, SMS_DISCLOSURE } from "./sms";
import type { ContactKind } from "./contact";
import type { Member } from "./types";
import { homeOf } from "./orgs";
import { markCodeSent } from "./auth-core";

/**
 * Someone a ward needs signed in to set it up (its administrators and the bishopric):
 * their sign-in codes may come from the site's email when the ward hasn't connected one.
 */
function runsAWard(memberId: number): boolean {
  return !!db()
    .prepare(
      `SELECT 1 FROM ward_admins WHERE member_id = @id
       UNION SELECT 1 FROM org_members om JOIN orgs o ON o.id = om.org_id WHERE om.member_id = @id AND o.kind = 'ward' AND om.role = 'presidency'
       UNION SELECT 1 FROM members WHERE id = @id AND is_site_owner = 1`,
    )
    .get({ id: memberId });
}

/** True when a sign-in code can't be emailed to them: their ward hasn't connected an email account. */
export function noEmailForSignIn(member: Member): boolean {
  return !canEmail(homeOf(member.id).orgId, runsAWard(member.id));
}

/** Sends a sign-in code to the phone number or email the member typed. */
export async function sendLoginCode(member: Member, via: ContactKind, token: string, code: string) {
  const home = homeOf(member.id);
  const appName = home.name;
  if (via === "phone" && member.phone) {
    // After joining with a phone number, the first text confirms the opt-in with the full disclosure.
    // Someone the presidency added hasn't agreed to texts yet, so they just get the code they asked for.
    const body =
      (member.sms_consent_at || (member as Member & { text_consent_pending?: number }).text_consent_pending) && !member.last_login_at
        ? `${appName} texts: ${code} is your sign-in code. ${SMS_DISCLOSURE}`
        : `${code} is your ${appName} sign-in code. It expires in 20 minutes. Reply STOP to opt out.`;
    const res = await sendSms(home.orgId, member.phone, body + codeTextFooter(code), "code");
    if (res === "sent") markCodeSent(token, "phone");
    return res === "sent";
  }
  if (!member.email) return false;
  markCodeSent(token, "email");
  const link = `${appUrl()}/auth/verify?token=${encodeURIComponent(token)}`;
  const text = `Hi ${member.display_name},\n\nTap the button below to sign in to ${appName}.\n\nOr enter this code in the app: ${code}\n\nThe link and code expire in 20 minutes. If you didn't ask to sign in, you can ignore this email.`;
  return sendMail({
    to: member.email,
    subject: `Your sign-in code: ${code}`,
    text: `${text}\n\n${link}`,
    html: emailHtml(`Sign in to ${appName}`, text, { url: link, label: "Sign in" }),
    orgId: home.orgId,
    essential: runsAWard(member.id),
  });
}

/**
 * An account message (like "you're approved") to the contact the member
 * signed up with. Sent even when the monthly text limit is reached.
 */
export async function sendAccountNotice(member: Member, subject: string, text: string, link: { url: string; label: string }) {
  const home = homeOf(member.id);
  if (member.email && (await sendMail({ to: member.email, subject, text: `${text}\n\n${link.url}`, html: emailHtml(subject, text, link), orgId: home.orgId, essential: runsAWard(member.id) }))) return true;
  if (member.phone && member.sms_consent_at) {
    return (await sendSms(home.orgId, member.phone, `${home.name}: ${text.replace(/\s+/g, " ").replace(/^Hi [^,]+, /, "")} ${link.url}`, "code")) === "sent";
  }
  return false;
}
