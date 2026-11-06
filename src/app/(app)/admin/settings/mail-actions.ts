"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkMailLogin, emailHtml, sendMail } from "@/lib/mail";
import { orgFullName } from "@/lib/orgs";
import { sealSecret } from "@/lib/secret-box";
import type { CurrentUser } from "@/lib/types";

/** Back to the page the form was on (Admin → Settings, or Ward settings). */
function back(fd: FormData, text: string): never {
  const page = fd.get("back") === "ward" ? "/ward-settings" : "/admin/settings";
  redirect(`${page}?msg=${encodeURIComponent(text)}#email`);
}

/**
 * Who may connect an organization's email: its presidency (the bishopric for the
 * ward's), the ward's administrators for the ward's own, and the site owner.
 */
function mayManage(user: CurrentUser, orgId: number): boolean {
  const org = user.orgs.find((o) => o.id === orgId);
  if (!org) return false;
  return (
    !!user.is_site_owner ||
    org.role === "presidency" ||
    (org.kind === "ward" && user.wardAdmin)
  );
}

const cleanAddress = (s: string) => s.trim().toLowerCase();

/** Connects (or changes) an organization's email account, after checking it signs in. */
export async function saveOrgMail(fd: FormData) {
  const user = await requireUser();
  const orgId = Number(fd.get("org_id"));
  if (!mayManage(user, orgId))
    back(fd, "Only the organization's leaders can change its email.");
  const address = cleanAddress(String(fd.get("address") || ""));
  // Gmail shows app passwords in groups of four with spaces.
  const password = String(fd.get("password") || "").replace(/\s+/g, "");
  const fromName = String(fd.get("from_name") || "")
    .trim()
    .slice(0, 80);
  const host =
    String(fd.get("host") || "")
      .trim()
      .toLowerCase() || "smtp.gmail.com";
  const port = [465, 587].includes(Number(fd.get("port")))
    ? Number(fd.get("port"))
    : 465;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
    back(fd, "Enter the email address to send from.");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host))
    back(fd, "Enter the email server's name (for Gmail, smtp.gmail.com).");
  const existing = db()
    .prepare("SELECT address, host, port FROM org_mail WHERE org_id = ?")
    .get(orgId) as { address: string; host: string; port: number } | undefined;
  // Changing only the sender name keeps the saved password.
  if (!password) {
    if (
      existing &&
      existing.address === address &&
      existing.host === host &&
      existing.port === port
    ) {
      db()
        .prepare(
          "UPDATE org_mail SET from_name = ?, updated_at = datetime('now') WHERE org_id = ?",
        )
        .run(fromName, orgId);
      revalidatePath("/", "layout");
      back(fd, "Sender name saved.");
    }
    back(fd, "Enter the app password for that email account.");
  }
  const problem = await checkMailLogin(address, password, host, port);
  if (problem) back(fd, problem);
  db()
    .prepare(
      `INSERT INTO org_mail (org_id, address, secret, from_name, host, port, set_by, updated_at) VALUES (@org, @address, @secret, @name, @host, @port, @by, datetime('now'))
       ON CONFLICT(org_id) DO UPDATE SET address = excluded.address, secret = excluded.secret, from_name = excluded.from_name, host = excluded.host, port = excluded.port,
         set_by = excluded.set_by, updated_at = excluded.updated_at, last_error = NULL, last_error_at = NULL`,
    )
    .run({
      org: orgId,
      address,
      secret: sealSecret(password),
      name: fromName,
      host,
      port,
      by: user.id,
    });
  const to = user.email;
  const sent =
    !!to &&
    (await sendMail({
      to,
      subject: "Your email is connected",
      text: `Email from ${orgFullName(orgId)} in My Ward Link now comes from ${address}. Replies go to that inbox.`,
      html: emailHtml(
        "Your email is connected",
        `Email from ${orgFullName(orgId)} in My Ward Link now comes from ${address}. Replies go to that inbox.`,
      ),
      orgId,
    }));
  revalidatePath("/", "layout");
  back(
    fd,
    `Connected: email from ${orgFullName(orgId)} now comes from ${address}.${sent ? ` A test email was sent to ${to}.` : ""}`,
  );
}

/** Sends a test email from the organization's email to the leader. */
export async function testOrgMail(fd: FormData) {
  const user = await requireUser();
  const orgId = Number(fd.get("org_id"));
  if (!mayManage(user, orgId))
    back(fd, "Only the organization's leaders can change its email.");
  if (!user.email)
    back(
      fd,
      "Add an email to your account first (More → Contact & notifications), so there's somewhere to send the test.",
    );
  const ok = await sendMail({
    to: user.email,
    subject: "Test email",
    text: "Email from the app is working.",
    html: emailHtml("It works!", "Email from the app is working."),
    orgId,
  });
  back(
    fd,
    ok
      ? `Test email sent to ${user.email}.`
      : "The test email didn't send. See the message under the email account.",
  );
}

/** Disconnects the organization's own email (it then uses the ward's, if there is one). */
export async function removeOrgMail(fd: FormData) {
  const user = await requireUser();
  const orgId = Number(fd.get("org_id"));
  if (!mayManage(user, orgId))
    back(fd, "Only the organization's leaders can change its email.");
  db().prepare("DELETE FROM org_mail WHERE org_id = ?").run(orgId);
  revalidatePath("/", "layout");
  back(fd, "Email account disconnected.");
}
