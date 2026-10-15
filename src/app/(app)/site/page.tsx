import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/time";
import { dataOnVolume } from "@/lib/setup-code";
import { monthlyLimit, phoneEnabled, textsThisMonth, twilioConfigured } from "@/lib/sms";
import { inboundUrl } from "@/lib/sms-inbound";
import { emailConfigured } from "@/lib/mail";
import { appUrl } from "@/lib/config";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { TimezoneSelect } from "@/components/timezone-select";
import { addWard, leadWard, removeWard, saveTextLimit, sendTestEmail, sendTestText, setWardTexting } from "./actions";

export const metadata = { title: "Site owner" };

interface WardRow {
  id: number;
  name: string;
  created_at: string;
  texting_enabled: number;
  creator: string | null;
  creator_contact: string | null;
  people: number;
  orgs: number;
}

/** What happened to an incoming text, in words. */
const TEXT_RESULTS: Record<string, string> = {
  saved: "Saved as a message",
  rejected: "Refused",
  answer_sent: "Sent as a leader's answer",
  asked_who: "Asked the leader who it's for",
  opted_out: "Opted out (STOP)",
  ignored: "Ignored (HELP/START, or too many)",
  unknown_sender: "Number not in the app",
  teacher_confirmed: "Confirmed teaching",
  teacher_declined: "Can't teach",
  request_accepted: "Accepted teaching request",
  request_declined: "Declined teaching request",
  request_taken: "Teaching request already taken",
};

export default async function SiteOwnerPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  if (!user.is_site_owner) redirect("/");
  const sp = await searchParams;
  const wards = db()
    .prepare(
      `SELECT w.id, w.name, w.created_at, w.texting_enabled, m.display_name AS creator, COALESCE(m.email, m.phone) AS creator_contact,
         (SELECT COUNT(*) FROM ward_members wm WHERE wm.ward_id = w.id) AS people,
         (SELECT COUNT(*) FROM orgs o WHERE o.ward_id = w.id AND o.kind = 'group' AND o.active = 1) AS orgs
       FROM wards w LEFT JOIN members m ON m.id = w.created_by ORDER BY w.created_at DESC`,
    )
    .all() as WardRow[];
  const incoming = db()
    .prepare(
      `SELECT l.id, l.result, l.note, l.created_at, m.display_name AS name FROM sms_inbound_log l LEFT JOIN members m ON m.id = l.member_id ORDER BY l.id DESC LIMIT 25`,
    )
    .all() as { id: number; result: string; note: string; created_at: string; name: string | null }[];
  return (
    <>
      <PageHeader title="Site owner" back={{ href: "/more", label: "More" }} subtitle="Every ward on this app, email and texting, and backups. Only you see this page." />
      <Flash msg={sp.msg} />
      <Flash msg={sp.error} tone="danger" />

      <Section title={`Wards (${wards.length})`}>
        <ul className="space-y-3">
          {wards.map((w) => (
            <li key={w.id} className="card space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{w.name}</span>
                {w.texting_enabled ? <Badge tone="success">Texting on</Badge> : <Badge tone="warn">Texting off</Badge>}
              </div>
              <div className="text-muted">
                {w.people} {w.people === 1 ? "person" : "people"} · {w.orgs} {w.orgs === 1 ? "organization" : "organizations"} · started {formatDate(w.created_at.slice(0, 10), "short")}
                {w.creator && ` by ${w.creator}${w.creator_contact ? ` (${w.creator_contact})` : ""}`}
                {phoneEnabled() && ` · ${textsThisMonth(w.id)} of ${monthlyLimit(w.id)} texts this month`}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={setWardTexting}>
                  <input type="hidden" name="ward_id" value={w.id} />
                  <input type="hidden" name="on" value={w.texting_enabled ? "0" : "1"} />
                  <SubmitButton className="btn-secondary btn-sm">{w.texting_enabled ? "Turn texting off" : "Turn texting on"}</SubmitButton>
                </form>
                {phoneEnabled() && !!w.texting_enabled && (
                  <form action={saveTextLimit} className="flex items-center gap-1">
                    <input type="hidden" name="ward_id" value={w.id} />
                    <input name="limit" type="number" min={0} max={100000} defaultValue={monthlyLimit(w.id)} className="input w-24 py-1 text-sm" aria-label={`Monthly text limit for ${w.name}`} />
                    <SubmitButton className="btn-secondary btn-sm">Set limit</SubmitButton>
                  </form>
                )}
                <form action={leadWard}>
                  <input type="hidden" name="ward_id" value={w.id} />
                  <SubmitButton className="btn-secondary btn-sm" confirm={`Join the ${w.name} bishopric in the app, so you can manage it?`}>
                    Manage this ward
                  </SubmitButton>
                </form>
                <details>
                  <summary className="btn-secondary btn-sm cursor-pointer text-danger">Delete…</summary>
                  <form action={removeWard} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="ward_id" value={w.id} />
                    <input name="confirm" required className="input max-w-56" placeholder={`Type ${w.name}`} />
                    <SubmitButton className="btn-danger btn-sm">Delete ward</SubmitButton>
                  </form>
                  <p className="hint">Deletes its organizations, lessons, calendar and messages. People in no other ward are deleted too.</p>
                </details>
              </div>
            </li>
          ))}
        </ul>
        <p className="hint mt-2">
          Wards other people start have texting off: reminder and message texts are on your Twilio account and texting registration. Sign-in codes are always texted. Email works
          for every ward.
        </p>
      </Section>

      <Section title="Email and texting">
        <div className="card max-w-xl space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            Email: {emailConfigured() ? <Badge tone="success">Connected</Badge> : <Badge tone="warn">Not set up: emails are saved to data/outbox</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            Texting:{" "}
            {twilioConfigured() ? (
              <Badge tone="success">Connected to Twilio</Badge>
            ) : phoneEnabled() ? (
              <Badge tone="warn">Test mode: texts are saved to data/outbox</Badge>
            ) : (
              <Badge>Not set up: members sign in with email only</Badge>
            )}
          </div>
          <p className="text-muted">Links in emails and texts point to {appUrl()}</p>
          {phoneEnabled() && (
            <p className="text-muted">
              So text replies reach the leaders, Twilio&apos;s incoming-message webhook is <code className="rounded bg-surface-2 px-1 break-all">{inboundUrl()}</code>. Each
              ward&apos;s monthly limit (above) covers reminder and message texts; at the limit they pause until next month and members get email. Sign-in codes always send
              (about 1.3¢ each).
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <form action={sendTestEmail}>
              <SubmitButton className="btn-secondary btn-sm" pendingText="Sending…">
                Send me a test email
              </SubmitButton>
            </form>
            {phoneEnabled() && (
              <form action={sendTestText}>
                <SubmitButton className="btn-secondary btn-sm" pendingText="Sending…">
                  Send me a test text
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      </Section>

      {phoneEnabled() && (
        <Section title="Incoming texts">
          <div className="card max-w-xl text-sm">
            <p className="mb-2 text-muted">Texts people sent to the app&apos;s number in the last 30 days, and where each went (the words are in their conversations).</p>
            {incoming.length === 0 ? (
              <p className="text-muted">None yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {incoming.map((t) => (
                  <li key={t.id} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                    <span>
                      <span className="font-medium">{t.name ?? "Unknown number"}</span>
                      <span className="text-muted"> · {[TEXT_RESULTS[t.result] ?? t.result, t.note].filter(Boolean).join(": ")}</span>
                    </span>
                    <span className="text-muted">{formatDateTime(t.created_at, user.ward.timezone, "LLL d, h:mm a")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}

      <Section title="Start a ward for someone">
        <form action={addWard} className="card max-w-xl space-y-3">
          <input name="ward_name" required className="input" placeholder="Ward name, e.g. Maple Ward" />
          <TimezoneSelect name="timezone" defaultValue={user.ward.timezone} />
          <input name="name" required className="input" placeholder="Their bishop's (or clerk's) full name" />
          <input name="email" type="email" required className="input" placeholder="Their email" />
          <SubmitButton className="btn-secondary" pendingText="Adding…">
            Add ward and email them
          </SubmitButton>
          <p className="hint">Anyone can also start a ward themselves from the sign-in page (Start a ward).</p>
        </form>
      </Section>

      <Section title="Backup">
        <div className="card max-w-xl space-y-3 text-sm">
          {!dataOnVolume() && (
            <p className="rounded-lg border border-danger bg-danger/10 p-3">
              <strong>This server has no permanent disk.</strong> Everything here is erased the next time the app is rebuilt. Download a backup now, then attach a volume at{" "}
              <code>/data</code> to the service and restore it.
            </p>
          )}
          <p>Download everything the app keeps (every ward, its organizations and members, and uploaded PDFs) as one file. Download one before big changes.</p>
          <p className="text-muted">The file holds members&apos; private information. Keep it somewhere safe and delete it when you no longer need it.</p>
          <a href="/api/backup" className="btn-secondary btn-sm" download>
            Download a backup
          </a>
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer font-semibold text-danger">Restore a backup</summary>
            <form action="/api/restore" method="post" encType="multipart/form-data" className="mt-3 space-y-3">
              <p className="text-muted">
                Replaces <strong>everything</strong> on this server with the backup: every ward, member and message here now is lost. Everyone, you included, signs in again
                afterwards.
              </p>
              <input name="backup" type="file" required accept=".tar,.db" className="input" />
              <input name="confirm" required className="input max-w-56" placeholder="Type RESTORE" autoCapitalize="characters" />
              <SubmitButton className="btn-danger btn-sm" pendingText="Restoring…">
                Replace everything with this backup
              </SubmitButton>
            </form>
          </details>
        </div>
      </Section>
    </>
  );
}
