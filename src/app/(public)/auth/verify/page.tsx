import { SubmitButton } from "@/components/client";
import { verifyToken } from "../../actions";

export const metadata = { title: "Sign in" };

// The link only shows a button; signing in happens on submit, so email
// security scanners that open links can't use up the token.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { token } = await searchParams;
  return (
    <div className="card text-center">
      <h2 className="h2 mb-2">Finish signing in</h2>
      <p className="mb-5 text-sm text-muted">Tap the button to finish signing in on this device.</p>
      <form action={verifyToken}>
        <input type="hidden" name="token" value={token ?? ""} />
        <SubmitButton className="btn-primary w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>
    </div>
  );
}
