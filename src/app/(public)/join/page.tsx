import Link from "next/link";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { joinApp } from "../actions";
import { joinCodeAllowsTexting, phoneOptInVisible } from "@/lib/sms";

export const metadata = { title: "Join" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  // A join link for a ward with no texting asks for an email only.
  const phone = phoneOptInVisible() && joinCodeAllowsTexting(sp.code);
  return (
    <div className="card">
      <h2 className="h2 mb-1">Join the app</h2>
      {sp.notfound ? (
        <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          There&apos;s no account for <strong>{sp.contact}</strong> yet. Join below.
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted">Get reminders, sign up to serve, and see what your ward and its organizations have planned.</p>
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
          <label className="label" htmlFor="contact">
            {phone ? "Mobile number or email" : "Email"}
          </label>
          <input id="contact" name="contact" type={phone ? "text" : "email"} required className="input" defaultValue={sp.contact} autoComplete={phone ? "username" : "email"} autoCapitalize="off" placeholder={phone ? "(208) 555-0142 or you@example.com" : undefined} />
          <p className="hint">{phone ? "Use whichever you prefer. You can add the other later." : "Used only to sign you in and send your ward\u2019s notices."}</p>
        </div>
        <div>
          <label className="label" htmlFor="join_code">
            Ward join code
          </label>
          <input id="join_code" name="join_code" required className="input" autoCapitalize="characters" autoComplete="off" defaultValue={sp.code} />
          <p className="hint">Ask your bishopric or an organization presidency for your ward&apos;s code.</p>
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-sm">
          <input type="checkbox" name="agree" required className="mt-1" />
          <span>
            I understand this app keeps only my name, {phone ? "the phone number or email I give" : "my email"}, and what I choose to post, and that I can delete my account at any time.
            {phone && " If I give a mobile number, I agree to receive sign-in codes and messages from my ward by text. Message and data rates may apply. Reply STOP to opt out, HELP for help."}{" "}
            <Link href="/privacy" className="link" target="_blank">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="link" target="_blank">
              Terms
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
        </Link>{" "}
        · Your ward isn&apos;t here yet?{" "}
        <Link href="/start" className="link">
          Start it
        </Link>
      </p>
    </div>
  );
}
