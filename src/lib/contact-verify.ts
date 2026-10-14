import crypto from "crypto";
import { DateTime } from "luxon";
import { db } from "./db";
import { sha256 } from "./auth-core";
import { emailHtml, sendMail } from "./mail";
import { codeTextFooter, sendSms, SMS_DISCLOSURE } from "./sms";
import { formatContact, type ContactKind } from "./contact";
import type { Member } from "./types";
import { homeOf } from "./orgs";

const hashFor = (memberId: number, kind: ContactKind, value: string, code: string) => sha256(`${memberId}:${kind}:${value}:${code}`);

/** Sends a code to a phone number or email a member is adding. Returns the pending id. */
export async function startContactVerification(member: Member, kind: ContactKind, value: string): Promise<{ ok: true; id: number } | { ok: false; reason: string }> {
  const d = db();
  const recent = d.prepare("SELECT COUNT(*) AS n FROM contact_verifications WHERE member_id = ? AND created_at > datetime('now', '-1 hour')").get(member.id) as { n: number };
  if (recent.n >= 5) return { ok: false, reason: "Too many codes. Please wait an hour and try again." };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const id = Number(
    d
      .prepare("INSERT INTO contact_verifications (member_id, kind, value, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(member.id, kind, value, hashFor(member.id, kind, value, code), DateTime.utc().plus({ minutes: 20 }).toISO()).lastInsertRowid,
  );
  const home = homeOf(member.id);
  const appName = home.name;
  const sent =
    kind === "phone"
      ? (await sendSms(home.orgId, value, `${appName}: ${code} is your code to confirm this number for ward texts. ${SMS_DISCLOSURE}${codeTextFooter(code)}`, "code")) === "sent"
      : await sendMail({
          to: value,
          subject: `Confirm your email: ${code}`,
          text: `Enter this code in the app to add this email to your account: ${code}\n\nIt expires in 20 minutes. If you didn't ask for this, you can ignore it.`,
          html: emailHtml("Confirm your email", `Enter this code in the app to add this email to your account: ${code}\n\nIt expires in 20 minutes. If you didn't ask for this, you can ignore it.`),
        });
  if (!sent) return { ok: false, reason: `We couldn't send a code to ${formatContact(kind, value)}. Please check it and try again.` };
  return { ok: true, id };
}

/** Checks the code; on success returns what was confirmed. */
export function confirmContactVerification(memberId: number, id: number, code: string): { kind: ContactKind; value: string } | null {
  const d = db();
  const row = d
    .prepare("SELECT * FROM contact_verifications WHERE id = ? AND member_id = ? AND expires_at > ?")
    .get(id, memberId, DateTime.utc().toISO()) as { id: number; kind: ContactKind; value: string; code_hash: string; attempts: number } | undefined;
  if (!row || row.attempts >= 5) return null;
  if (row.code_hash !== hashFor(memberId, row.kind, row.value, code.replace(/\D/g, ""))) {
    d.prepare("UPDATE contact_verifications SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return null;
  }
  d.prepare("DELETE FROM contact_verifications WHERE member_id = ?").run(memberId);
  return { kind: row.kind, value: row.value };
}

export function pendingVerification(memberId: number, id: number) {
  return db()
    .prepare("SELECT kind, value FROM contact_verifications WHERE id = ? AND member_id = ? AND expires_at > ?")
    .get(id, memberId, DateTime.utc().toISO()) as { kind: ContactKind; value: string } | undefined;
}
