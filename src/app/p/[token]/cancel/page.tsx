import { guestForCancel } from "@/lib/guest-signups";
import { getShare } from "@/lib/public-shares";
import { SubmitButton } from "@/components/client";
import { cancelGuestSignup } from "../actions";

export const metadata = { title: "Cancel sign-up" };

/**
 * The "Can't make it?" link a guest got when they signed up. Opening it only asks:
 * email scanners and link previews open links on their own, so cancelling takes a tap.
 * The link works even after the public page is stopped.
 */
export default async function CancelGuestPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const share = getShare(token);
  const done = sp.done === "1";
  const guest = done ? undefined : guestForCancel(Number(sp.g), String(sp.t || ""));
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      {done ? (
        <>
          <h1 className="h2">You&apos;re no longer signed up</h1>
          <p className="text-sm text-muted">Thanks for letting us know. Your spot is open for someone else.</p>
        </>
      ) : guest ? (
        <>
          <h1 className="h2">Can&apos;t make it?</h1>
          <p className="text-sm text-muted">
            {guest.name}, you&apos;re signed up for {guest.title}: {guest.slot_label}.
          </p>
          <form action={cancelGuestSignup}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="g" value={guest.id} />
            <input type="hidden" name="t" value={String(sp.t)} />
            <SubmitButton className="btn-danger" pendingText="Cancelling…">
              Cancel my sign-up
            </SubmitButton>
          </form>
        </>
      ) : (
        <>
          <h1 className="h2">Nothing to cancel</h1>
          <p className="text-sm text-muted">This sign-up was already cancelled or the link isn&apos;t valid anymore.</p>
        </>
      )}
      {share && (
        <a href={`/p/${token}`} className="link block text-sm">
          Back to the sign-up
        </a>
      )}
    </div>
  );
}
