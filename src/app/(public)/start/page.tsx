import Link from "next/link";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { TimezoneSelect } from "@/components/timezone-select";
import { DEFAULT_TZ } from "@/lib/time";
import { phoneOptInVisible } from "@/lib/sms";
import { callingLabel, CALLINGS } from "@/lib/types";
import { startWard } from "../actions";
import { needsSetup } from "@/lib/wards";
import { dataOnVolume } from "@/lib/setup-code";

export const metadata = { title: "Start a ward" };

export default async function StartWardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const phone = phoneOptInVisible();
  const empty = needsSetup();
  return (
    <div className="card">
      <h2 className="h2 mb-1">Start your ward</h2>
      <p className="mb-4 text-sm text-muted">
        Set up the app for your ward: you&apos;ll get a join code to share, add your ward&apos;s organizations, and choose who leads each one.{" "}
        {empty ? "" : "Each new ward is reviewed before it opens (we may contact you to confirm), so you'll see it right away but can start using it once it's approved. "}
        Already in a ward here?{" "}
        <Link href="/login" className="link">
          Sign in
        </Link>{" "}
        and start it from More → My organizations.
      </p>
      {empty && !dataOnVolume() && (
        <div className="mb-4 rounded-lg border border-danger bg-danger/10 p-3 text-sm">
          <strong>This server has no permanent disk.</strong> Anything you set up here is erased every time the app is rebuilt. Attach a volume at <code>/data</code> first.
        </div>
      )}
      {empty && (
        <p className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          This is the first ward on this server, so you&apos;ll be its site owner. Moving the app from another server instead?{" "}
          <Link href="/setup" className="link font-semibold">
            Restore a backup
          </Link>
        </p>
      )}
      <Flash msg={sp.error} tone="danger" />
      <form action={startWard} className="space-y-4">
        <div>
          <label className="label" htmlFor="ward_name">
            Ward name
          </label>
          <input id="ward_name" name="ward_name" required maxLength={80} className="input" placeholder="e.g. Maple Ward" defaultValue={sp.ward_name} />
        </div>
        {!empty && (
          <div>
            <label className="label" htmlFor="stake">
              Stake
            </label>
            <input id="stake" name="stake" required maxLength={80} className="input" placeholder="e.g. Meridian Idaho Stake" defaultValue={sp.stake} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="timezone">
            Time zone
          </label>
          <TimezoneSelect id="timezone" name="timezone" defaultValue={DEFAULT_TZ} />
        </div>
        <div>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input id="name" name="name" required maxLength={100} className="input" autoComplete="name" defaultValue={sp.name} />
        </div>
        <div>
          <label className="label" htmlFor="calling">
            Your calling
          </label>
          <select id="calling" name="calling" className="input" defaultValue="">
            {CALLINGS.ward.map((c) => (
              <option key={c} value={c}>
                {callingLabel(c, { kind: "ward", name: "" })}
              </option>
            ))}
            <option value="">Something else (e.g. ward clerk)</option>
          </select>
          <p className="hint">You&apos;ll lead the ward in the app with the bishopric. You can add them, and change this, later.</p>
        </div>
        <div>
          <label className="label" htmlFor="contact">
            {phone ? "Mobile number or email" : "Email"}
          </label>
          <input id="contact" name="contact" type={phone ? "text" : "email"} required className="input" defaultValue={sp.contact} autoComplete={phone ? "username" : "email"} autoCapitalize="off" />
          <p className="hint">To sign you in. No password needed.</p>
        </div>
        {!empty && (
          <div>
            <label className="label" htmlFor="note">
              Anything that helps us confirm your ward <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea id="note" name="note" rows={3} maxLength={1000} className="input" placeholder="e.g. your bishop's name, or a good time to call" />
          </div>
        )}
        <label className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-sm">
          <input type="checkbox" name="agree" required className="mt-1" />
          <span>
            I understand this app keeps only my name, {phone ? "the phone number or email I give" : "my email"}, and what I choose to post, and that I can delete my account at any time. I&apos;ll
            get reminders and messages from my ward {phone ? "by text or email (whichever I give)" : "by email"} and app notifications, and can change that anytime under More → Contact &amp;
            notifications.
            {phone && " If I give a mobile number, I agree to receive sign-in codes, reminders and messages from my ward by text. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help."}{" "}
            <Link href="/privacy" className="link" target="_blank">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="link" target="_blank">
              Terms
            </Link>
          </span>
        </label>
        <SubmitButton className="btn-primary w-full" pendingText="Starting…">
          Start the ward and sign me in
        </SubmitButton>
      </form>
    </div>
  );
}
