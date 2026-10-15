import fs from "fs";
import path from "path";
import nodemailer, { type Transporter } from "nodemailer";
import { DATA_DIR } from "./db";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user, pass },
  });
  return transporter;
}

export const emailConfigured = () => getTransporter() !== null;

/**
 * Sends an email. When SMTP isn't configured (local preview), the message is
 * written to data/outbox so it can be read without a mail server.
 */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    const dir = path.join(DATA_DIR, "outbox");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${msg.to.replace(/[^a-z0-9@.]/gi, "_")}.txt`);
    fs.writeFileSync(file, `To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
    console.log(`[mail] (not configured) wrote ${file}`);
    return true;
  }
  try {
    const fromName = process.env.MAIL_FROM_NAME || "Elders Quorum";
    await t.sendMail({ from: `"${fromName}" <${process.env.SMTP_USER}>`, ...msg });
    return true;
  } catch (err) {
    console.error("[mail] send failed", err);
    return false;
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Simple branded HTML wrapper for notification emails. */
/** heading "" leaves the heading out (e.g. a personal note). */
export function emailHtml(heading: string, bodyText: string, link?: { url: string; label: string }) {
  const paragraphs = escapeHtml(bodyText)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = link
    ? `<p style="margin:22px 0"><a href="${escapeHtml(link.url)}" style="background:#1d3a5f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(link.label)}</a></p>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1f2933;line-height:1.5">
${heading ? `<h2 style="color:#1d3a5f;margin:0 0 16px">${escapeHtml(heading)}</h2>` : ""}${paragraphs}${button}</div>`;
}
