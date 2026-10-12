import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { REMEMBER_OPTIONS } from "@/lib/auth-core";
import { needsSetup } from "@/lib/wards";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { requestLogin } from "../actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (needsSetup()) redirect("/setup");
  if (await getUser()) redirect("/");
  const sp = await searchParams;
  return (
    <div className="card">
      <h2 className="h2 mb-1">Sign in</h2>
      <p className="mb-4 text-sm text-muted">We&apos;ll email you a sign-in link and code. No password needed.</p>
      <Flash msg={sp.error} tone="danger" />
      <Flash msg={sp.ok} />
      <form action={requestLogin} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" defaultValue={sp.email} />
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
          Email me a sign-in link
        </SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/join" className="link">
          Join the app
        </Link>
      </p>
    </div>
  );
}
