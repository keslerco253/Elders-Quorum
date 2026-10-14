import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { REMEMBER_OPTIONS } from "@/lib/auth-core";
import { needsSetup } from "@/lib/wards";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { requestLogin } from "../actions";
import { phoneOptInVisible } from "@/lib/sms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  // A brand-new server: the first person starts a ward (and is the site owner).
  if (needsSetup()) redirect("/start");
  if (await getUser()) redirect("/");
  const sp = await searchParams;
  const phone = phoneOptInVisible();
  return (
    <div className="card">
      <h2 className="h2 mb-1">Sign in</h2>
      <p className="mb-4 text-sm text-muted">{phone ? "We'll text or email you a sign-in code." : "We'll email you a sign-in link and code."} No password needed.</p>
      <Flash msg={sp.error} tone="danger" />
      <Flash msg={sp.ok} />
      <form action={requestLogin} className="space-y-4">
        <div>
          <label className="label" htmlFor="contact">
            {phone ? "Mobile number or email" : "Email"}
          </label>
          <input id="contact" name="contact" type={phone ? "text" : "email"} inputMode={phone ? "email" : undefined} autoComplete={phone ? "username" : "email"} autoCapitalize="off" required className="input" defaultValue={sp.contact} placeholder={phone ? "(208) 555-0142 or you@example.com" : undefined} />
        </div>
        <div>
          <label className="label" htmlFor="remember">
            Keep me signed in for
          </label>
          <select id="remember" name="remember" className="input" defaultValue="month">
            {Object.entries(REMEMBER_OPTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Sending…">
          {phone ? "Send me a code" : "Email me a sign-in link"}
        </SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/join" className="link">
          Join your ward
        </Link>{" "}
        ·{" "}
        <Link href="/start" className="link">
          Start a ward
        </Link>
      </p>
    </div>
  );
}
