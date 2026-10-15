import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { signOut } from "../actions";
import { SubmitButton } from "@/components/client";

export const metadata = { title: "Under review" };

/** Where someone lands while the ward they started waits for the site owner's approval. */
export default async function ReviewPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!user.ward.pending) redirect("/");
  const orgs = db().prepare("SELECT name FROM orgs WHERE ward_id = ? AND kind = 'group' AND active = 1 ORDER BY name").all(user.ward_id) as { name: string }[];
  // Other wards they're in (already approved) can still be used.
  const others = user.wards.filter((w) => !w.pending);
  const wardOrgOf = (wardId: number) => (db().prepare("SELECT id FROM orgs WHERE ward_id = ? AND kind = 'ward'").get(wardId) as { id: number }).id;
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="h2">Your ward is under review</h2>
        <p className="mt-1 text-sm text-muted">
          Thanks for setting up <strong>{user.ward.name}</strong>! To keep every ward&apos;s information safe, each new ward is checked before it opens. You&apos;ll get a{" "}
          {user.phone && !user.email ? "text" : "message"} as soon as it&apos;s approved, usually within a day.
        </p>
      </div>
      <div className="rounded-lg bg-surface-2 p-3 text-sm">
        <div className="font-semibold">{user.ward.name}</div>
        {user.ward.stake && <div className="text-muted">{user.ward.stake}</div>}
        <div className="mt-2 text-muted">Ready and waiting: {orgs.map((o) => o.name).join(", ")}.</div>
        <div className="mt-1 text-muted">You&apos;re set up to lead it. Once it&apos;s approved, you&apos;ll get its join code to share and can add its leaders.</div>
      </div>
      {others.length > 0 && (
        <p className="text-sm">
          Meanwhile, go to{" "}
          {others.map((w, i) => (
            <span key={w.id}>
              {i > 0 && ", "}
              <a className="link" href={`/?org=${wardOrgOf(w.id)}`}>
                {w.name}
              </a>
            </span>
          ))}
          .
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <form action={signOut}>
          <SubmitButton className="btn-secondary btn-sm" pendingText="Signing out…">
            Sign out
          </SubmitButton>
        </form>
        <Link href="/about" className="text-sm text-muted hover:text-text">
          About My Ward Link
        </Link>
      </div>
    </div>
  );
}
