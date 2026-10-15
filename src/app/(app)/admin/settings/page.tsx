import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { emailConfigured } from "@/lib/mail";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { TimezoneSelect } from "@/components/timezone-select";
import { addOrganization, deleteOrganization, saveOrgSettings, saveTextLimit, saveWardSettings, sendTestEmail, sendTestText, setJoinCode, startAnotherWard } from "./actions";
import { db } from "@/lib/db";
import { hasFeature, orgRoster } from "@/lib/orgs";
import { FEATURES, type Feature } from "@/lib/types";

const SUGGESTED_ORGS = ["Elders Quorum", "Relief Society", "Young Men", "Young Women", "Primary", "Sunday School", "Ward Mission", "Activities Committee"];
import { monthlyLimit, phoneEnabled, textsThisMonth, twilioConfigured } from "@/lib/sms";
import { inboundUrl } from "@/lib/sms-inbound";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const mail = emailConfigured();
  // Ward settings are for the bishopric, when looking at the ward itself.
  const ward = user.org.kind === "ward" && user.wardLeader;
  const groups = ward
    ? (db()
        .prepare(
          `SELECT o.id, o.name,
             (SELECT COUNT(*) FROM org_members om WHERE om.org_id = o.id AND (om.official = 1 OR om.role <> 'member')) AS people,
             (SELECT COUNT(*) FROM org_members om WHERE om.org_id = o.id AND om.role = 'presidency') AS leaders
           FROM orgs o WHERE o.ward_id = ? AND o.kind = 'group' ORDER BY o.name COLLATE NOCASE`,
        )
        .all(user.ward_id) as { id: number; name: string; people: number; leaders: number }[])
    : [];
  const roster = ward ? orgRoster(user.org_id) : [];
  return (
    <>
      <PageHeader title="Settings" back={{ href: "/admin", label: "Admin" }} />
      <Flash msg={sp.msg} />
      <Section title={user.org.kind === "ward" ? "Features" : "This organization"}>
        <form action={saveOrgSettings} className="card max-w-xl space-y-4">
          {user.org.kind === "group" && (
            <div>
              <label className="label" htmlFor="org-name">
                Name
              </label>
              <input id="org-name" name="name" required maxLength={60} className="input" defaultValue={user.org.name} />
            </div>
          )}
          <fieldset>
            <legend className="label">What {user.orgLabel} uses</legend>
            <div className="space-y-1">
              {(Object.keys(FEATURES) as Feature[]).map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`feature_${f}`} defaultChecked={hasFeature(user.org, f)} /> {FEATURES[f]}
                </label>
              ))}
            </div>
            <p className="hint">Turned-off features are hidden from everyone in {user.orgLabel}. Nothing is deleted.</p>
          </fieldset>
          <SubmitButton>Save</SubmitButton>
        </form>
        {user.org.kind === "group" && (
          <p className="mt-3 max-w-xl text-sm text-muted">
            The join code, time zone and the list of organizations are managed by the bishopric, under {user.ward.name} in the menu at the top.
          </p>
        )}
      </Section>
      {ward && (
        <>
          <Section title="Ward">
            <form action={saveWardSettings} className="card max-w-xl space-y-4">
              <div>
                <label className="label" htmlFor="name">
                  Ward name
                </label>
                <input id="name" name="name" required maxLength={80} className="input" defaultValue={user.ward.name} />
              </div>
              <div>
                <label className="label" htmlFor="timezone">
                  Time zone
                </label>
                <TimezoneSelect id="timezone" name="timezone" defaultValue={user.ward.timezone} />
                <p className="hint">Lesson reminders go out Sunday at 7:00 PM and Saturday at 8:00 AM in this time zone.</p>
              </div>
              <SubmitButton>Save</SubmitButton>
            </form>
          </Section>
          <Section title="Join code">
            <div className="card max-w-xl space-y-3">
              <p className="text-sm">
                Everyone joins {user.ward.name} with <strong className="rounded bg-surface-2 px-2 py-1 font-mono text-lg tracking-widest">{user.ward.join_code}</strong>, then
                chooses their organizations. Change it if it gets shared outside the ward.
              </p>
              <Link href="/admin/invite" className="btn-primary btn-sm">
                Show QR code to invite members
              </Link>
              <form action={setJoinCode} className="flex flex-wrap gap-2">
                <SubmitButton name="mode" value="new" className="btn-secondary btn-sm" confirm="Make a new code? The old one stops working.">
                  Make a new code
                </SubmitButton>
              </form>
              <form action={setJoinCode} className="flex flex-wrap gap-2">
                <input type="hidden" name="mode" value="custom" />
                <input name="code" placeholder="Or your own, e.g. VILLAS-WARD" className="input max-w-56" />
                <SubmitButton className="btn-secondary btn-sm">Use this code</SubmitButton>
              </form>
            </div>
          </Section>
          <Section title="Organizations">
            <div className="card max-w-xl space-y-4 text-sm">
              <ul className="divide-y divide-border">
                {groups.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">{o.name}</span>
                      <span className="text-muted">
                        {" "}
                        · {o.people} {o.people === 1 ? "member" : "members"}
                        {o.leaders ? "" : " · no presidency yet"}
                      </span>
                    </span>
                    <a href={`/?org=${o.id}`} className="link">
                      Open
                    </a>
                  </li>
                ))}
                {groups.length === 0 && <li className="py-2 text-muted">None yet. Add the organizations your ward uses below.</li>}
              </ul>
              <details>
                <summary className="cursor-pointer font-semibold">Add an organization</summary>
                <form action={addOrganization} className="mt-3 space-y-3">
                  <div>
                    <label className="label" htmlFor="new-org">
                      Name
                    </label>
                    <input id="new-org" name="name" required maxLength={60} className="input" list="org-names" placeholder="e.g. Relief Society" />
                    <datalist id="org-names">
                      {SUGGESTED_ORGS.filter((n) => !groups.some((g) => g.name === n)).map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="label" htmlFor="leader">
                      President (optional)
                    </label>
                    <select id="leader" name="leader_id" className="input" defaultValue="">
                      <option value="">Choose later</option>
                      {roster.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name}
                        </option>
                      ))}
                    </select>
                    <p className="hint">They can add their counselors and secretary from Members.</p>
                  </div>
                  <fieldset>
                    <legend className="label">Uses</legend>
                    {(Object.keys(FEATURES) as Feature[]).map((f) => (
                      <label key={f} className="flex items-center gap-2">
                        <input type="checkbox" name={`feature_${f}`} defaultChecked /> {FEATURES[f]}
                      </label>
                    ))}
                  </fieldset>
                  <SubmitButton pendingText="Adding…">Add organization</SubmitButton>
                </form>
              </details>
              {groups.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-danger">Delete an organization</summary>
                  <form action={deleteOrganization} className="mt-3 space-y-3">
                    <select name="org_id" className="input" required>
                      {groups.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <input name="confirm" className="input" placeholder="Type its name to confirm" required />
                    <p className="hint">Deletes its lessons, events, sign-ups, messages and visit records. Members stay in the ward.</p>
                    <SubmitButton className="btn-danger btn-sm">Delete</SubmitButton>
                  </form>
                </details>
              )}
            </div>
          </Section>
          <Section title="Another ward">
            <details id="start-ward" className="card max-w-xl text-sm">
              <summary className="cursor-pointer font-semibold">Start a new ward</summary>
              <form action={startAnotherWard} className="mt-3 space-y-3">
                <p className="text-muted">For a ward that isn&apos;t in the app yet. You&apos;ll lead it in the app until you add its bishopric there.</p>
                <input name="ward_name" required maxLength={80} className="input" placeholder="Ward name, e.g. Maple Ward" />
                <TimezoneSelect name="timezone" defaultValue={user.ward.timezone} />
                <SubmitButton className="btn-secondary" pendingText="Starting…">
                  Start ward
                </SubmitButton>
              </form>
            </details>
          </Section>
        </>
      )}
      <Section title="Email">
        <div className="card max-w-xl space-y-3 text-sm">
          <div className="flex items-center gap-2">
            Status: {mail ? <Badge tone="success">Connected</Badge> : <Badge tone="warn">Not set up: emails are saved to data/outbox</Badge>}
          </div>
          <p className="text-muted">Links in emails point to {appUrl()}</p>
          <form action={sendTestEmail}>
            <SubmitButton className="btn-secondary btn-sm" pendingText="Sending…">
              Send me a test email
            </SubmitButton>
          </form>
        </div>
      </Section>
      <Section title="Texting">
        <div className="card max-w-xl space-y-3 text-sm">
          <div className="flex items-center gap-2">
            Status:{" "}
            {twilioConfigured() ? (
              <Badge tone="success">Connected to Twilio</Badge>
            ) : phoneEnabled() ? (
              <Badge tone="warn">Test mode: texts are saved to data/outbox</Badge>
            ) : (
              <Badge>Not set up: members sign in with email only</Badge>
            )}
          </div>
          {phoneEnabled() && !user.ward.texting_enabled && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">
              Reminder and message texts are off for {user.ward.name} until the app&apos;s site owner turns them on. Sign-in codes are still texted, and everything else
              goes by notification and email.
            </p>
          )}
          {phoneEnabled() ? (
            <>
              <p>
                This month in {user.ward.name}: <strong>{textsThisMonth(user.ward_id, "notice")}</strong> of {monthlyLimit(user.ward_id)} reminder and message texts, plus{" "}
                <strong>{textsThisMonth(user.ward_id, "code")}</strong> sign-in codes (about 1.3¢ each).
                {textsThisMonth(user.ward_id, "reply") > 0 && (
                  <>
                    {" "}
                    Members texted back <strong>{textsThisMonth(user.ward_id, "reply")}</strong> times; those count toward the limit.
                  </>
                )}
              </p>
              <p className="text-muted">At the limit, reminder and message texts pause until next month and those members get email if they have one. Sign-in codes always send.</p>
              <p className="text-muted">
                So text replies reach the presidency, set Twilio&apos;s incoming-message webhook to{" "}
                <code className="rounded bg-surface-2 px-1 break-all">{inboundUrl()}</code> (see the setup guide).
              </p>
              {ward && (
                <form action={saveTextLimit} className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="label" htmlFor="limit">
                      Monthly text limit for the ward
                    </label>
                    <input id="limit" name="limit" type="number" min={0} max={100000} defaultValue={monthlyLimit(user.ward_id)} className="input w-32" />
                  </div>
                  <SubmitButton className="btn-secondary btn-sm">Save limit</SubmitButton>
                </form>
              )}
              <form action={sendTestText}>
                <SubmitButton className="btn-secondary btn-sm" pendingText="Sending…">
                  Send me a test text
                </SubmitButton>
              </form>
            </>
          ) : (
            <p className="text-muted">To let members sign in and get messages by text, follow &quot;Texting (optional)&quot; in docs/SETUP-WINDOWS.md.</p>
          )}
        </div>
      </Section>
    </>
  );
}
