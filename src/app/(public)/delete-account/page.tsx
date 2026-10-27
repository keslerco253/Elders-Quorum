import Link from "next/link";
import { getUser } from "@/lib/auth";
import { publicAppName } from "@/lib/wards";
import { contactEmail } from "@/lib/config";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { deleteMyAccount } from "@/app/(app)/more/actions";

// The contact address is a server setting, and the page depends on who's signed in.
export const dynamic = "force-dynamic";

export const metadata = { title: "Delete your account" };

/**
 * How to delete an account and its data, for app stores (Google Play's account
 * deletion URL) and anyone without the app: sign in here with a code, then delete.
 */
export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await getUser();
  const brand = publicAppName();
  const email = contactEmail();
  return (
    <div className="card prose-eq space-y-3">
      <h2 className="h2">Delete your {brand} account</h2>
      <Flash msg={sp.msg} tone="danger" />
      <p>
        You can delete your <strong>{brand}</strong> account and the information that goes with it at any time, from the app or from this page. {brand} is run by volunteers
        (not by The Church of Jesus Christ of Latter-day Saints).
      </p>

      <h3>Delete it now</h3>
      {user ? (
        <form action={deleteMyAccount} className="space-y-3 rounded-lg border border-border p-3 text-sm not-prose">
          <input type="hidden" name="from" value="delete-account" />
          <p>
            Signed in as <strong>{user.display_name}</strong>
            {user.email ? ` (${user.email})` : user.phone ? ` (${user.phone})` : ""}. This can&apos;t be undone.
          </p>
          <input name="confirm" placeholder="Type DELETE to confirm" className="input" autoComplete="off" aria-label="Type DELETE to confirm" />
          <SubmitButton className="btn-danger" pendingText="Deleting…" confirm="Delete your account permanently?">
            Delete my account
          </SubmitButton>
        </form>
      ) : (
        <>
          <ol>
            <li>Sign in with the phone number or email you use for {brand}. We&apos;ll send you a 6-digit code (no password needed).</li>
            <li>You&apos;ll come back to this page. Type DELETE and tap <strong>Delete my account</strong>.</li>
          </ol>
          <Link href="/login?next=%2Fdelete-account" className="btn-danger">
            Sign in to delete my account
          </Link>
        </>
      )}
      <p>
        <strong>In the app:</strong> open <strong>More</strong>, scroll to <strong>Delete my account</strong>, type DELETE and tap <strong>Delete my account</strong>.
      </p>
      <p>
        <strong>Can&apos;t sign in?</strong> Email <a href={`mailto:${email}?subject=${encodeURIComponent(`Delete my ${brand} account`)}`}>{email}</a> from the email on your
        account (or tell us the phone number on it), or ask your ward&apos;s leaders to remove you. We&apos;ll confirm it&apos;s you, then delete the account within 30 days.
      </p>
      <p>
        If you&apos;re the only presidency member of an organization, give someone else presidency access first (Admin → Members), so the organization still has a leader.
      </p>

      <h3>What&apos;s deleted</h3>
      <ul>
        <li>Your account: your name, phone number, email, sign-in sessions and devices, and your notification settings and reminders.</li>
        <li>
          What you posted: lesson comments, teacher notes, offers to teach, sign-ups, RSVPs, event requests, visit requests, messages you sent your leaders, your private
          to-dos, your journal, and your answers to meeting invitations.
        </li>
        <li>Which organizations you belong to, your callings, and the visits recorded for you.</li>
      </ul>

      <h3>What&apos;s kept</h3>
      <ul>
        <li>
          Things you created for others as a leader (events, lessons, service opportunities, announcements, meeting agendas and assignments you gave) stay for the ward, but
          no longer show your name. Assignments given to you stay with the organization, with no one assigned.
        </li>
        <li>Challenge team totals your entries counted toward (not your name).</li>
        <li>
          Daily backups, kept only to recover from a server failure, are replaced as they age: your information is gone from all of them within 30 days.
        </li>
      </ul>
      <p>
        Deleting is immediate and permanent. You can join your ward again later with its join code as a new member. See the{" "}
        <Link href="/privacy" className="link">
          Privacy Policy
        </Link>{" "}
        for how long other information is kept.
      </p>
    </div>
  );
}
