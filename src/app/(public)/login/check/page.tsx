import Link from "next/link";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { verifyCode } from "../../actions";
import { formatContact, parseContact } from "@/lib/contact";

export const metadata = { title: "Enter your code" };

export default async function CheckPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = parseContact(sp.to ?? "");
  const byText = c?.kind === "phone";
  return (
    <div className="card">
      <h2 className="h2 mb-1">{byText ? "Check your texts" : "Check your email"}</h2>
      <p className="mb-4 text-sm text-muted">
        {byText ? "We texted a 6-digit code to " : "We sent a sign-in link and a 6-digit code to "}
        <strong className="text-text">{c ? formatContact(c.kind, c.value) : sp.to}</strong>.{byText ? " Type it here." : " Tap the link, or type the code here."}
      </p>
      <Flash msg={sp.error} tone="danger" />
      <form action={verifyCode} className="space-y-4">
        <input type="hidden" name="to" value={sp.to ?? ""} />
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
      {!byText && (
        <p className="mt-4 text-xs text-muted">Using the installed app on iPhone? Type the code here. The email link opens in Safari instead of the app.</p>
      )}
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="link">
          Use a different number or email
        </Link>
      </p>
    </div>
  );
}
