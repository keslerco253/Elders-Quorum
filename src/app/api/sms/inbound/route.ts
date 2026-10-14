import { AUTO_REPLIES, handleInboundText, inboundUrl, validTwilioSignature } from "@/lib/sms-inbound";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/contact";
import { twilioConfigured } from "@/lib/sms";
import { homeOf } from "@/lib/orgs";

// Twilio posts here when someone texts the app's number ("A message comes in" webhook).
// The empty reply means Twilio sends nothing back to the member.
const EMPTY = new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { "content-type": "text/xml" } });

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  if (twilioConfigured()) {
    if (!validTwilioSignature(inboundUrl(), params, req.headers.get("x-twilio-signature") || "", process.env.TWILIO_AUTH_TOKEN!)) {
      console.error("[sms] inbound text rejected: signature didn't match", inboundUrl());
      return new Response("Forbidden", { status: 403 });
    }
  } else if (process.env.SMS_DEV_OUTBOX !== "1") {
    return new Response("Texting isn't set up", { status: 404 });
  }

  const result = await handleInboundText(params);
  if (result !== "saved") console.log("[sms] inbound text", result);
  const reply = AUTO_REPLIES[result];
  if (!reply) return EMPTY.clone();
  // The confirmation text back counts toward the monthly limit like any other.
  const m = db().prepare("SELECT id, last_text_org_id FROM members WHERE phone = ? AND status = 'active' LIMIT 1").get(normalizePhone(params.From || "") ?? "") as
    | { id: number; last_text_org_id: number | null }
    | undefined;
  const orgId = m ? (m.last_text_org_id ?? homeOf(m.id).orgId) : null;
  if (orgId && twilioConfigured()) db().prepare("INSERT INTO sms_log (org_id, kind) VALUES (?, 'notice')").run(orgId);
  const xml = reply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xml}</Message></Response>`, { headers: { "content-type": "text/xml" } });
}
