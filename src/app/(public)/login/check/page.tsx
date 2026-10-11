import Link from "next/link";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { verifyCode } from "../../actions";

export const metadata = { title: "Check your email" };

export default async function CheckPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <div className="card">
      <h2 className="h2 mb-1">Check your email</h2>
      <p className="mb-4 text-sm text-muted">
        We sent a sign-in link and a 6-digit code to <strong className="text-text">{sp.email}</strong>. Tap the link, or type the code here.
      </p>
      <Flash msg={sp.error} tone="danger" />
      <form action={verifyCode} className="space-y-4">
        <input type="hidden" name="email" value={sp.email ?? ""} />
        <div>
          <label className="label" htmlFor="code">
            6-digit code
          </label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required className="input text-center text-2xl tracking-[0.4em]" />
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Checking…">
          Sign in
        </SubmitButton>
      </form>
      <p className="mt-4 text-xs text-muted">
        Using the installed app on iPhone? Type the code here. The email link opens in Safari instead of the app.
      </p>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="link">
          Use a different email
        </Link>
      </p>
    </div>
  );
}
