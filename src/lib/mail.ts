import fs from "fs";
import path from "path";
import nodemailer, { type Transporter } from "nodemailer";
import { DATA_DIR, db } from "./db";
import { orgFullName } from "./orgs";
import { openSecret, sealSecret } from "./secret-box";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Files sent with it (e.g. a flyer). */
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  /**
   * The organization it's from: sent from its own email account, else its ward's, else
   * (for wards that use it) the site's. Left out: the site's own email.
   */
  orgId?: number | null;
  /** A sign-in code a ward needs to get started (its administrators, a ward being set up): the site's email may send it. */
  essential?: boolean;
}

/** About as many as one Gmail account may send in a day (Google's limit is around 500). */
export const DAILY_LIMIT = 450;

export interface OrgMail {
  org_id: number;
  address: string;
  secret: string;
  from_name: string;
  host: string;
  port: number;
  updated_at: string;
  sent_day: string | null;
  sent_count: number;
  last_error: string | null;
  last_error_at: string | null;
}

export function orgMail(orgId: number): OrgMail | undefined {
  return db().prepare("SELECT * FROM org_mail WHERE org_id = ?").get(orgId) as OrgMail | undefined;
}

const today = () => new Date().toISOString().slice(0, 10);
export const sentToday = (m: Pick<OrgMail, "sent_day" | "sent_count">) => (m.sent_day === today() ? m.sent_count : 0);

/** Where an organization's email goes out from, in order: its own account, its ward's, then the site's (when allowed). */
export function mailRoute(orgId: number | null | undefined, essential = false): ("site" | OrgMail)[] {
  if (!orgId) return ["site"];
  const row = db()
    .prepare("SELECT o.ward_id, w.site_email, w.pending, (SELECT id FROM orgs x WHERE x.ward_id = o.ward_id AND x.kind = 'ward') AS ward_org FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE o.id = ?")
    .get(orgId) as { ward_id: number; site_email: number; pending: number; ward_org: number | null } | undefined;
  if (!row) return ["site"];
  const route: ("site" | OrgMail)[] = [];
  const own = orgMail(orgId);
  if (own) route.push(own);
  const ward = row.ward_org && row.ward_org !== orgId ? orgMail(row.ward_org) : undefined;
  if (ward) route.push(ward);
  // A ward still being set up, one that uses the site's email, or a code its administrators need to sign in.
  if (row.site_email || row.pending || essential) route.push("site");
  return route;
}

/** Whether email can go out for this organization at all. */
export const canEmail = (orgId: number | null | undefined, essential = false) => mailRoute(orgId, essential).length > 0;

const accounts = new Map<number, { stamp: string; t: Transporter }>();

function accountTransport(m: OrgMail): Transporter | null {
  const cached = accounts.get(m.org_id);
  if (cached?.stamp === m.updated_at + m.address) return cached.t;
  const pass = openSecret(m.secret);
  if (!pass) return null;
  cached?.t.close();
  const t = nodemailer.createTransport({ host: m.host, port: m.port, secure: m.port === 465, auth: { user: m.address, pass }, pool: true, maxConnections: 2 });
  accounts.set(m.org_id, { stamp: m.updated_at + m.address, t });
  return t;
}

/** Checks an address and app password by signing in (nothing is sent). Null when it works, else what went wrong. */
export async function checkMailLogin(address: string, password: string, host = "smtp.gmail.com", port = 465): Promise<string | null> {
  const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: address, pass: password }, connectionTimeout: 15000 });
  try {
    await t.verify();
    return null;
  } catch (err) {
    const e = err as { code?: string; responseCode?: number; message?: string };
    if (e.code === "EAUTH" || e.responseCode === 535 || e.responseCode === 534)
      return "The email provider didn't accept that address and app password. For Gmail, use a 16-letter app password (not the account's normal password), with 2-Step Verification turned on.";
    return `Couldn't reach the email server (${String(e.message ?? err).slice(0, 120)}). Please try again.`;
  } finally {
    t.close();
  }
}

/** The message itself, without where it's from. */
function plain(msg: MailMessage): MailMessage {
  const out = { ...msg };
  delete out.orgId;
  delete out.essential;
  return out;
}

/** Sends from an organization's account, counting it toward the day's limit. */
async function sendFromAccount(m: OrgMail, msg: MailMessage): Promise<boolean> {
  if (sentToday(m) >= DAILY_LIMIT) return false;
  const t = accountTransport(m);
  const d = db();
  if (!t) {
    d.prepare("UPDATE org_mail SET last_error = ?, last_error_at = datetime('now') WHERE org_id = ?").run("The saved app password can't be read anymore. Please enter it again.", m.org_id);
    return false;
  }
  try {
    await t.sendMail({ from: { name: m.from_name || orgFullName(m.org_id), address: m.address }, ...plain(msg) });
    const day = today();
    d.prepare("UPDATE org_mail SET sent_count = CASE WHEN sent_day = ? THEN sent_count + 1 ELSE 1 END, sent_day = ? WHERE org_id = ?").run(day, day, m.org_id);
    return true;
  } catch (err) {
    console.error(`[mail] org ${m.org_id} send failed`, err);
    d.prepare("UPDATE org_mail SET last_error = ?, last_error_at = datetime('now') WHERE org_id = ?").run(String((err as Error)?.message ?? err).slice(0, 300), m.org_id);
    return false;
  }
}

/** The site's own email account, set by the site owner in the app (Site owner → Email); sealed like the organizations'. */
type SavedSiteMail = { address: string; secret: string; from_name: string; host: string; port: number; updated_at: string };

function savedSiteMail(): SavedSiteMail | null {
  try {
    const raw = (db().prepare("SELECT value FROM app_settings WHERE key = 'site_mail'").get() as { value: string } | undefined)?.value;
    return raw ? (JSON.parse(raw) as SavedSiteMail) : null;
  } catch {
    return null;
  }
}

/** The site's email account: the one set in the app, else the server's settings (SMTP_USER and SMTP_PASS). */
function siteAccount(): { address: string; pass: string; fromName: string; host: string; port: number; stamp: string } | null {
  const saved = savedSiteMail();
  if (saved) {
    const pass = openSecret(saved.secret);
    if (pass) return { address: saved.address, pass, fromName: saved.from_name, host: saved.host, port: saved.port, stamp: `app:${saved.updated_at}` };
  }
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return { address: user, pass, fromName: process.env.MAIL_FROM_NAME || "Elders Quorum", host: process.env.SMTP_HOST || "smtp.gmail.com", port, stamp: "server" };
}

/** What the site owner sees: the site's address and sender name, and where it's set. */
export function siteMailInfo(): { address: string; fromName: string; host: string; port: number; source: "app" | "server" } | null {
  const a = siteAccount();
  return a ? { address: a.address, fromName: a.fromName, host: a.host, port: a.port, source: a.stamp === "server" ? "server" : "app" } : null;
}

export function saveSiteMail(address: string, password: string, fromName: string, host = "smtp.gmail.com", port = 465) {
  const value: SavedSiteMail = { address, secret: sealSecret(password), from_name: fromName, host, port, updated_at: new Date().toISOString() };
  db().prepare("INSERT INTO app_settings (key, value) VALUES ('site_mail', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(value));
}

/** The sender name only (the password stays as saved). */
export function renameSiteMail(fromName: string): boolean {
  const saved = savedSiteMail();
  if (!saved) return false;
  db().prepare("UPDATE app_settings SET value = ? WHERE key = 'site_mail'").run(JSON.stringify({ ...saved, from_name: fromName, updated_at: new Date().toISOString() }));
  return true;
}

/** Back to the server's settings. */
export function clearSiteMail() {
  db().prepare("DELETE FROM app_settings WHERE key = 'site_mail'").run();
}

/** The saved account's password, to keep it when only the address or name changes. */
export function savedSiteMailPassword(): string | null {
  const saved = savedSiteMail();
  return saved ? openSecret(saved.secret) : null;
}

let transporter: { stamp: string; t: Transporter } | null = null;

function getTransporter() {
  const a = siteAccount();
  if (!a) return null;
  if (transporter?.stamp === a.stamp + a.address) return transporter.t;
  transporter?.t.close();
  const t = nodemailer.createTransport({ host: a.host, port: a.port, secure: a.port === 465, auth: { user: a.address, pass: a.pass } });
  transporter = { stamp: a.stamp + a.address, t };
  return t;
}

export const emailConfigured = () => getTransporter() !== null;

/**
 * Sends an email. When SMTP isn't configured (local preview), the message is
 * written to data/outbox so it can be read without a mail server.
 */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  // An organization's email: its own account, then its ward's, then (if allowed) the site's.
  if (msg.orgId) {
    for (const via of mailRoute(msg.orgId, msg.essential)) {
      if (via === "site") return sendFromSite(msg);
      if (await sendFromAccount(via, msg)) return true;
    }
    return false;
  }
  return sendFromSite(msg);
}

async function sendFromSite(msg: MailMessage): Promise<boolean> {
  msg = plain(msg);
  const t = getTransporter();
  if (!t) {
    const dir = path.join(DATA_DIR, "outbox");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${msg.to.replace(/[^a-z0-9@.]/gi, "_")}.txt`);
    const attached = msg.attachments?.length ? `Attachments: ${msg.attachments.map((a) => a.filename).join(", ")}\n` : "";
    fs.writeFileSync(file, `To: ${msg.to}\nSubject: ${msg.subject}\n${attached}\n${msg.text}\n`);
    console.log(`[mail] (not configured) wrote ${file}`);
    return true;
  }
  try {
    const a = siteAccount()!;
    await t.sendMail({ from: { name: a.fromName, address: a.address }, ...msg });
    noteMail("mail_last_sent", new Date().toISOString());
    return true;
  } catch (err) {
    console.error("[mail] send failed", err);
    noteMail("mail_last_error", JSON.stringify({ at: new Date().toISOString(), to: msg.to.replace(/^(.).*@/, "$1…@"), error: String((err as Error)?.message ?? err).slice(0, 300) }));
    return false;
  }
}

/** Remembers the last email sent and the last failure, for the site owner's page. */
function noteMail(key: string, value: string) {
  try {
    db().prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  } catch {
    // Never let this stop an email.
  }
}

/** When email last worked, and the last failure (when, to whom, the error). */
export function mailStatus(): { lastSent: string | null; lastError: { at: string; to: string; error: string } | null } {
  const get = (k: string) => (db().prepare("SELECT value FROM app_settings WHERE key = ?").get(k) as { value: string } | undefined)?.value ?? null;
  let lastError = null;
  try {
    lastError = JSON.parse(get("mail_last_error") ?? "null");
  } catch {
    lastError = null;
  }
  return { lastSent: get("mail_last_sent"), lastError };
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
