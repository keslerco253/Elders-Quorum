import Link from "next/link";
import { listWards } from "@/lib/wards";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { requestAccess } from "../actions";

export const metadata = { title: "Request access" };

export default async function RequestAccessPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const wards = listWards();
  return (
    <div className="card">
      <h2 className="h2 mb-1">Request access</h2>
      {sp.notfound ? (
        <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          We couldn&apos;t find <strong>{sp.email}</strong> on the quorum list. Send a request and the presidency will review it.
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted">The presidency will review your request. You&apos;ll get an email when it&apos;s approved.</p>
      )}
      <Flash msg={sp.error} tone="danger" />
      <form action={requestAccess} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input id="name" name="name" required className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" required className="input" defaultValue={sp.email} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone (optional)
          </label>
          <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" />
        </div>
        {wards.length > 1 ? (
          <div>
            <label className="label" htmlFor="ward_id">
              Ward
            </label>
            <select id="ward_id" name="ward_id" className="input" required>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="ward_id" value={wards[0]?.id ?? ""} />
        )}
        <div>
          <label className="label" htmlFor="note">
            Anything the presidency should know? (optional)
          </label>
          <textarea id="note" name="note" rows={3} className="input" placeholder="e.g. I just moved into the ward" />
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Sending…">
          Send request
        </SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
