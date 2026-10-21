import Link from "next/link";
import { redirect } from "next/navigation";
import { dataOnVolume } from "@/lib/setup-code";
import { needsSetup } from "@/lib/wards";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export const metadata = { title: "New server" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!needsSetup()) redirect("/login");
  const sp = await searchParams;
  return (
    <div className="card">
      <h2 className="h2 mb-1">A new, empty server</h2>
      <p className="mb-4 text-sm text-muted">Start the first ward, or bring everything over from another server with a backup.</p>
      {!dataOnVolume() && (
        <div className="mb-4 rounded-lg border border-danger bg-danger/10 p-3 text-sm">
          <strong>This server has no permanent disk.</strong> Anything you set up or restore here is erased every time the app is rebuilt. In Northflank, open the service → <strong>Volumes</strong> → add a volume with mount path <code>/data</code>, wait for it to restart, then come back here.
        </div>
      )}
      <Flash msg={sp.error} tone="danger" />
      <Link href="/start" className="btn-primary w-full">
        Start the first ward
      </Link>
      <p className="mt-2 text-sm text-muted">
        Whoever starts the first ward is the site owner{process.env.OWNER_EMAIL ? " (or the account with the OWNER_EMAIL address)" : ""}: they can see every ward, turn on texting
        for wards others start, and back up or restore the app.
      </p>
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
              <input id="restore_code" name="setup_code" required autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} className="input" />
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
          <p className="mt-3 text-sm text-muted">
            Start a ward with the site owner&apos;s email{process.env.OWNER_EMAIL ? "" : " (set OWNER_EMAIL on the server first)"}, then restore from{" "}
            <strong>Admin → Site owner → Restore a backup</strong>. That replaces the new ward with everything in the backup.
          </p>
        )}
      </details>
    </div>
  );
}
