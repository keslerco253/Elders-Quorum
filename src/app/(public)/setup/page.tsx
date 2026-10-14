import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/wards";
import { DEFAULT_TZ } from "@/lib/time";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { TimezoneSelect } from "@/components/timezone-select";
import { runSetup } from "../actions";

export const metadata = { title: "First-time setup" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!needsSetup()) redirect("/login");
  const sp = await searchParams;
  return (
    <div className="card">
      <h2 className="h2 mb-1">First-time setup</h2>
      <p className="mb-4 text-sm text-muted">Create your ward and your own presidency account. You&apos;ll be able to add everyone else after you sign in.</p>
      <Flash msg={sp.error} tone="danger" />
      <form action={runSetup} className="space-y-4">
        {process.env.SETUP_CODE && (
          <div>
            <label className="label" htmlFor="setup_code">
              Setup code
            </label>
            <input id="setup_code" name="setup_code" required className="input" />
            <p className="hint">From the SETUP_CODE line in your settings file.</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="ward_name">
            App name
          </label>
          <input id="ward_name" name="ward_name" required className="input" defaultValue="Villas Ward Elders Quorum" />
        </div>
        <div>
          <label className="label" htmlFor="timezone">
            Time zone
          </label>
          <TimezoneSelect id="timezone" name="timezone" defaultValue={DEFAULT_TZ} />
        </div>
        <div>
          <label className="label" htmlFor="name">
            Your full name
          </label>
          <input id="name" name="name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Your email
          </label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Creating…">
          Create and email me a sign-in link
        </SubmitButton>
      </form>
      <details className="mt-6 border-t border-border pt-4">
        <summary className="cursor-pointer font-medium">Moving from another server? Restore a backup</summary>
        {process.env.SETUP_CODE ? (
          <form action="/api/restore" method="post" encType="multipart/form-data" className="mt-3 space-y-4">
            <p className="text-sm text-muted">
              Choose the file from Admin → Settings → Download a backup on the old server (or a nightly app-….db backup). Everyone&apos;s accounts and history come across; each person
              signs in again here.
            </p>
            <div>
              <label className="label" htmlFor="restore_code">
                Setup code
              </label>
              <input id="restore_code" name="setup_code" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="backup">
                Backup file
              </label>
              <input id="backup" name="backup" type="file" required accept=".tar,.db" className="input" />
            </div>
            <SubmitButton className="btn-secondary w-full" pendingText="Restoring…">
              Restore backup
            </SubmitButton>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">Add a SETUP_CODE setting to this server first; restoring needs it.</p>
        )}
      </details>
    </div>
  );
}
