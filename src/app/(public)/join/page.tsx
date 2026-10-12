import Link from "next/link";
import { listWards } from "@/lib/wards";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { joinApp } from "../actions";

export const metadata = { title: "Join" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const wards = listWards();
  return (
    <div className="card">
      <h2 className="h2 mb-1">Join the app</h2>
      {sp.notfound ? (
        <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          There&apos;s no account for <strong>{sp.email}</strong> yet. Join below.
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted">Get lesson reminders, sign up to help, and see quorum activities.</p>
      )}
      <Flash msg={sp.error} tone="danger" />
      <form action={joinApp} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input id="name" name="name" required maxLength={100} className="input" autoComplete="name" defaultValue={sp.name} />
          <p className="hint">Shown with your comments and sign-ups.</p>
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" required className="input" defaultValue={sp.email} autoComplete="email" />
          <p className="hint">Used only to sign you in and send quorum notices.</p>
        </div>
        <div>
          <label className="label" htmlFor="join_code">
            Join code
          </label>
          <input id="join_code" name="join_code" className="input" autoCapitalize="characters" autoComplete="off" />
          <p className="hint">Announced in elders quorum. No code? Leave it blank and the presidency will approve your request.</p>
        </div>
        {wards.length > 1 && (
          <div>
            <label className="label" htmlFor="ward_id">
              Ward (only needed without a code)
            </label>
            <select id="ward_id" name="ward_id" className="input">
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="note">
            Note to the presidency (optional, only without a code)
          </label>
          <input id="note" name="note" maxLength={500} className="input" placeholder="e.g. I just moved into the ward" />
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-sm">
          <input type="checkbox" name="agree" required className="mt-1" />
          <span>
            I understand this app keeps only my name, my email, and what I choose to post, and that I can delete my account at any time.{" "}
            <Link href="/privacy" className="link" target="_blank">
              Details
            </Link>
          </span>
        </label>
        <SubmitButton className="btn-primary w-full" pendingText="Joining…">
          Join
        </SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm">
        Already joined?{" "}
        <Link href="/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
