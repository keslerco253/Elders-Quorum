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
import { addWard, approveNewWard, declineNewWard, leadWard, loadCfmSchedule, setUpReview, removeCfmYear, removeWard,
  clearWardData, saveTextLimit, sendTestEmail, sendTestText, setWardTexting } from "./actions";
import { pendingWards } from "@/lib/ward-review";
import { formatPhone } from "@/lib/contact";
import { cfmYears, manualUrl } from "@/lib/cfm";
import { DEMO_WARD_NAME, demoWard } from "@/lib/review-demo";
import type { CfmWeek } from "@/lib/cfm";

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
  asked_which: "Asked which organization it's for",
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
  const pending = pendingWards();
  const cfm = cfmYears();
  const thisYear = new Date().getFullYear();
  // Next year's manual is usually out by late fall.
  const loadYear = cfm.some((y) => Number(y.year) === thisYear) ? thisYear + 1 : thisYear;
  const demo = demoWard();
  const reviewer = demo
    ? (db().prepare("SELECT m.email FROM members m JOIN ward_members wm ON wm.member_id = m.id WHERE wm.ward_id = ? AND m.email IS NOT NULL LIMIT 1").get(demo.id) as { email: string } | undefined)
    : undefined;
  const reviewSet = (process.env.REVIEW_LOGIN || "").split(":")[0]?.trim().toLowerCase();
  const cfmWeeks = db().prepare("SELECT * FROM cfm_weeks ORDER BY sunday").all() as CfmWeek[];
  // Everyone with site-owner access: marked so (whoever set up the first ward), or signed
  // in with the OWNER_EMAIL address. Nothing in the app can give it to anyone else.
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const owners = db()
    .prepare("SELECT id, display_name, email, phone FROM members WHERE is_site_owner = 1 OR (? <> '' AND lower(email) = ? AND email_verified_at IS NOT NULL) ORDER BY id")
    .all(ownerEmail, ownerEmail) as { id: number; display_name: string; email: string | null; phone: string | null }[];
  return (
    <>
      <PageHeader title="Site owner" back={{ href: "/admin", label: "Admin" }} subtitle="Every ward on this app, email and texting, and backups. Only you see this page." />
      <Flash msg={sp.msg} />
      <Flash msg={sp.error} tone="danger" />
      <Section title="Who has site-owner access">
        <div className="card space-y-2 text-sm">
          <ul>
            {owners.map((o) => (
              <li key={o.id}>
                <strong>{o.display_name}</strong>
                <span className="text-muted">
                  {" "}
                  · {[o.email, o.phone && formatPhone(o.phone)].filter(Boolean).join(" · ")}
                  {o.id === user.id ? " (you)" : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">
            Only the person who set up the first ward, and anyone who signs in with the <code>OWNER_EMAIL</code> address set on the server ({ownerEmail || "not set"}). Nothing in
            the app can give this to anyone else.
          </p>
        </div>
      </Section>

      <div id="new-wards" className="scroll-mt-20">
        <Section title={`New wards to approve${pending.length ? ` (${pending.length})` : ""}`}>
          {pending.length === 0 ? (
            <p className="text-sm text-muted">Nothing waiting. When someone starts a ward, it&apos;s set up right away but stays under review (they can see it, but nothing can be done or sent in it) until you approve it here.</p>
          ) : (
            <ul className="space-y-3">
              {pending.map((w) => (
                <li key={w.id} className="card space-y-2 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-base font-semibold">
                      {w.name}
                      {w.stake && <span className="font-normal text-muted"> · {w.stake}</span>}
                    </span>
                    <span className="text-xs text-muted">{formatDateTime(w.created_at, user.ward.timezone, "LLL d, h:mm a")}</span>
                  </div>
                  <div>
                    Started by <strong>{w.creator ?? "someone"}</strong>
                    {w.creator_contact && (
                      <>
                        {" "}·{" "}
                        {w.creator_contact.includes("@") ? (
                          <a className="link" href={`mailto:${w.creator_contact}`}>
                            {w.creator_contact}
                          </a>
                        ) : (
                          <a className="link" href={`tel:${w.creator_contact}`}>
                            {formatPhone(w.creator_contact)}
                          </a>
                        )}
                      </>
                    )}
                  </div>
                  {w.request_note && <p className="rounded-lg bg-surface-2 px-3 py-2 whitespace-pre-wrap">{w.request_note}</p>}
                  <p className="text-xs text-muted">Check it&apos;s real first (for example, call them or check with their stake).</p>
                  <div className="flex flex-wrap items-start gap-2">
                    <form action={approveNewWard}>
                      <input type="hidden" name="ward_id" value={w.id} />
                      <SubmitButton pendingText="Approving…" confirm={`Open ${w.name} and tell ${w.creator ?? "them"}?`}>
                        Approve
                      </SubmitButton>
                    </form>
                    <details className="flex-1">
                      <summary className="btn-secondary inline-block cursor-pointer">Decline</summary>
                      <form action={declineNewWard} className="mt-2 space-y-2">
                        <input type="hidden" name="ward_id" value={w.id} />
                        <textarea name="note" rows={2} maxLength={500} className="input" placeholder="Optional note to them" />
                        <p className="text-xs text-muted">The ward is deleted, with their account if it isn&apos;t in another ward.</p>
                        <SubmitButton className="btn-danger btn-sm" pendingText="Declining…">
                          Decline and delete
                        </SubmitButton>
                      </form>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

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
                  <summary className="btn-secondary btn-sm cursor-pointer">Clear…</summary>
                  <form action={clearWardData} className="mt-2 space-y-2">
                    <input type="hidden" name="ward_id" value={w.id} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="what" value="messages" /> Messages and alerts
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="what" value="calendar" /> Calendar
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="what" value="service" /> Service
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input name="confirm" required className="input max-w-56" placeholder={`Type ${w.name}`} />
                      <SubmitButton className="btn-danger btn-sm">Clear</SubmitButton>
                    </div>
                  </form>
                  <p className="hint">
                    For going live after testing. <strong>Messages and alerts</strong>: every message and conversation (Messages) and everyone&apos;s Reminders &amp; alerts.{" "}
                    <strong>Calendar</strong>: every event, its RSVPs and event requests (presidency meetings stay, off the calendar). <strong>Service</strong>: every
                    opportunity with its sign-ups and public links. Plans, lessons, assignments and people always stay. Can&apos;t be undone (the nightly backup has them).
                  </p>
                </details>
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

      <div id="cfm" className="scroll-mt-20">
        <Section title="Come, Follow Me schedule">
          <p className="mb-3 text-sm text-muted">
            Sunday School lessons in every ward are filled from this, a lesson for every week, and members get a weekly reminder of what to study. Load each
            year once the Church posts the new manual (usually in the fall).
          </p>
          {cfm.length > 0 && (
            <ul className="mb-3 space-y-2">
              {cfm.map((y) => (
                <li key={y.year} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <strong>{y.year}</strong>: {y.weeks} weeks, {formatDate(y.first, "short")} to {formatDate(y.last, "short")}
                  </span>
                  <form action={removeCfmYear}>
                    <input type="hidden" name="year" value={y.year} />
                    <SubmitButton className="btn-secondary btn-sm" confirm={`Remove the ${y.year} schedule? Lessons already filled stay as they are.`}>
                      Remove
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {cfmWeeks.length > 0 && (
            <details className="mb-3 text-sm">
              <summary className="link cursor-pointer">See every week</summary>
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
                {cfmWeeks.map((w) => (
                  <li key={w.sunday} className="flex gap-3 px-3 py-2">
                    <span className="w-24 shrink-0 text-muted">{formatDate(w.sunday, "short")}</span>
                    <span className="min-w-0">
                      <a className="link" href={w.url} target="_blank" rel="noreferrer">
                        {w.reading}
                      </a>
                      {w.theme && <span className="block text-muted">{w.theme}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <form action={loadCfmSchedule} className="card space-y-3">
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <div>
                <label className="label" htmlFor="cfm-year">
                  Year
                </label>
                <input id="cfm-year" name="year" type="number" min={2025} max={2100} defaultValue={loadYear} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="cfm-manual">
                  The manual on churchofjesuschrist.org
                </label>
                <input id="cfm-manual" name="manual" type="url" className="input" defaultValue={manualUrl(loadYear)} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="cfm-contents">
                Or paste the manual&apos;s contents (optional)
              </label>
              <textarea
                id="cfm-contents"
                name="contents"
                rows={5}
                className="input text-sm"
                placeholder={"If loading from the website doesn't work: open the manual in Gospel Library, copy its list of lessons and paste it here.\n\nJanuary 5–11: Moses 1; Abraham 3\n“This Is My Work and My Glory”\nJanuary 12–18: Genesis 1–2; Moses 2–3\n…"}
              />
            </div>
            <p className="hint">Loading a year again updates its lessons, except ones someone has changed by hand.</p>
            <SubmitButton pendingText="Loading…">Load the schedule</SubmitButton>
          </form>
        </Section>
      </div>

      <div id="review" className="scroll-mt-20">
        <Section title="App Store review">
          <div className="card space-y-3 text-sm">
            <p>
              Apple and Google sign in to check the app. They get their own <strong>{DEMO_WARD_NAME}</strong> with made-up people, lessons, events, a
              service sign-up and a plan, so they never see anyone real. Their account is a plain member, and the made-up people have no email or phone, so
              nothing is sent to anyone.
            </p>
            {demo ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2">
                Ready: the reviewer signs in with <strong>{reviewer?.email}</strong>.{" "}
                {reviewSet === reviewer?.email ? (
                  <span className="text-success">REVIEW_LOGIN is set for it.</span>
                ) : (
                  <span className="text-warn">
                    Now set REVIEW_LOGIN on Northflank to <code>{reviewer?.email}:</code> and six digits of your choosing (for example{" "}
                    <code>{reviewer?.email}:482913</code>), and give Apple that code.
                  </span>
                )}
              </p>
            ) : null}
            <form action={setUpReview} className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className="label" htmlFor="review-email">
                  Reviewer&apos;s email
                </label>
                <input id="review-email" name="email" type="email" required className="input" defaultValue={reviewer?.email ?? (reviewSet || "")} placeholder="appreview@mywardlink.net" />
              </div>
              <SubmitButton pendingText="Setting up…" confirm={demo ? "Start the demo ward over with fresh sample data?" : undefined}>
                {demo ? "Start it over" : "Set up the demo ward"}
              </SubmitButton>
            </form>
            <p className="hint">The full checklist and the notes to give Apple are in docs/MOBILE-APP.md, under App review.</p>
          </div>
        </Section>
      </div>

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
