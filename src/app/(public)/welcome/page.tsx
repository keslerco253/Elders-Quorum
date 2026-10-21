import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { formatPhone } from "@/lib/contact";
import { phoneOptInVisible, SMS_DISCLOSURE, memberTextable } from "@/lib/sms";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { acceptWelcome } from "./actions";

export const metadata = { title: "Welcome" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.welcomed_at) redirect("/");
  const sp = await searchParams;
  const canText = !!user.phone && (phoneOptInVisible() && memberTextable(user.id));
  const options: [string, string][] = [
    ...(canText ? ([["text", `Text me at ${formatPhone(user.phone)}`]] as [string, string][]) : []),
    ...(user.email ? ([["email", `Email me at ${user.email}`]] as [string, string][]) : []),
    ...(canText && user.email ? ([["both", "Both text and email"]] as [string, string][]) : []),
    ["none", "Neither (I'll use notifications or check the app)"],
  ];
  // Never pre-select texting: agreeing to texts has to be the member's own choice.
  const preselected = user.email ? "email" : "none";

  return (
    <form action={acceptWelcome} className="card space-y-4">
      <div>
        <h2 className="h2">Welcome!</h2>
        <p className="mt-1 text-sm text-muted">{user.ward.name}&apos;s leaders added you to the app. Take a moment to check your details.</p>
      </div>
      <Flash msg={sp.msg} tone="warn" />
      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" required maxLength={100} className="input" defaultValue={user.display_name} />
        <p className="hint">Shown with your comments and sign-ups.</p>
      </div>
      <fieldset>
        <legend className="label">When notifications are off, how should we send reminders and messages?</legend>
        <div className="space-y-2">
          {options.map(([v, label]) => (
            <label key={v} className="flex items-start gap-2 text-sm">
              <input type="radio" name="pref" value={v} defaultChecked={v === preselected} className="mt-1" />
              {label}
            </label>
          ))}
        </div>
        {canText && (
          <p className="hint mt-2">
            By choosing a text option, I agree to receive sign-in codes, reminders and messages by text from {user.ward.name}. {SMS_DISCLOSURE} Consent isn&apos;t required to use the app.
          </p>
        )}
      </fieldset>
      <label className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-sm">
        <input type="checkbox" name="agree" required className="mt-1" />
        <span>
          I understand this app keeps only my name, the phone number or email I use, and what I choose to post, and that I can delete my account at any time.{" "}
          <Link href="/privacy" className="link" target="_blank">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="link" target="_blank">
            Terms
          </Link>
        </span>
      </label>
      <SubmitButton pendingText="Saving…" className="btn-primary w-full">
        Continue
      </SubmitButton>
    </form>
  );
}
