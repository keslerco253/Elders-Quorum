import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { emailConfigured } from "@/lib/mail";
import { listWards } from "@/lib/wards";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { TimezoneSelect } from "@/components/timezone-select";
import { addWard, saveWardSettings, sendTestEmail, setJoinCode } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const mail = emailConfigured();
  return (
    <>
      <PageHeader title="Settings" back={{ href: "/admin", label: "Admin" }} />
      <Flash msg={sp.msg} />
      <Section title="This ward">
        <form action={saveWardSettings} className="card max-w-xl space-y-4">
          <div>
            <label className="label" htmlFor="name">
              App name
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
          {user.ward.join_code ? (
            <p className="text-sm">
              Members who enter <strong className="rounded bg-surface-2 px-2 py-1 font-mono text-lg tracking-widest">{user.ward.join_code}</strong> when joining get in right away.
              Announce it in quorum meeting. Change it if it gets shared outside the quorum.
            </p>
          ) : (
            <p className="text-sm text-muted">No join code. Everyone who joins needs presidency approval.</p>
          )}
          {user.ward.join_code && (
            <Link href="/admin/invite" className="btn-primary btn-sm">
              Show QR code to invite members
            </Link>
          )}
          <form action={setJoinCode} className="flex flex-wrap gap-2">
            <SubmitButton name="mode" value="new" className="btn-primary btn-sm">
              {user.ward.join_code ? "Make a new code" : "Create a code"}
            </SubmitButton>
            {user.ward.join_code && (
              <SubmitButton name="mode" value="off" className="btn-secondary btn-sm" confirm="Turn off the join code? New members will need approval.">
                Turn off
              </SubmitButton>
            )}
          </form>
          <form action={setJoinCode} className="flex flex-wrap gap-2">
            <input type="hidden" name="mode" value="custom" />
            <input name="code" placeholder="Or your own, e.g. VILLAS-EQ" className="input max-w-56" />
            <SubmitButton className="btn-secondary btn-sm">Use this code</SubmitButton>
          </form>
        </div>
      </Section>
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
      {!!user.is_site_owner && (
        <Section title="Other wards">
          <div className="card max-w-xl space-y-4">
            <p className="text-sm text-muted">Wards on this app: {listWards().map((w) => w.name).join(", ")}. Each ward has its own members, lessons, calendar and admins.</p>
            <form action={addWard} className="space-y-3">
              <input name="ward_name" required className="input" placeholder="App name, e.g. Maple Ward Elders Quorum" />
              <TimezoneSelect name="timezone" defaultValue={user.ward.timezone} />
              <input name="name" required className="input" placeholder="Their elders quorum president's full name" />
              <input name="email" type="email" required className="input" placeholder="Their email" />
              <SubmitButton className="btn-secondary" pendingText="Adding…">
                Add ward and email the president
              </SubmitButton>
            </form>
          </div>
        </Section>
      )}
    </>
  );
}
