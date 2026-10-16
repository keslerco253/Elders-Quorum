import { cancelGuest } from "@/lib/guest-signups";
import { getShare } from "@/lib/public-shares";

export const metadata = { title: "Cancel sign-up" };

/** The "Can't make it?" link a guest got when they signed up. */
export default async function CancelGuestPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const share = getShare(token);
  const done = share ? cancelGuest(Number(sp.g), String(sp.t || "")) : false;
  return (
    <div className="card mx-auto max-w-md space-y-2 text-center">
      <h1 className="h2">{done ? "You're no longer signed up" : "Nothing to cancel"}</h1>
      <p className="text-sm text-muted">{done ? "Thanks for letting us know. Your spot is open for someone else." : "This sign-up was already cancelled or the link isn't valid anymore."}</p>
      {share && (
        <a href={`/p/${token}`} className="link text-sm">
          Back to the sign-up
        </a>
      )}
    </div>
  );
}
