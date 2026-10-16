import { redirect } from "next/navigation";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignup } from "@/lib/signups";
import { getPlan } from "@/lib/plans";
import { FlyerView } from "@/components/flyer-view";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createPublicShare } from "../actions";

export const metadata = { title: "Share publicly" };

/** Making a public link and QR code for one picture/PDF, or one service opportunity. */
export default async function NewSharePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const signup = sp.signup ? getSignup(user.org_id, Number(sp.signup)) : undefined;
  const plan = sp.plan ? getPlan(user.ward_id, Number(sp.plan)) : undefined;
  const file = !signup && !sp.plan && sp.file && db().prepare("SELECT 1 FROM plan_files WHERE name = ? AND ward_id = ?").get(sp.file, user.ward_id) ? sp.file : undefined;
  if (!signup && !file && !plan) redirect("/admin/shared");
  return (
    <>
      <PageHeader
        title="Share publicly"
        back={{ href: "/admin/shared", label: "Shared publicly" }}
        subtitle={
          signup
            ? `A link and QR code for "${signup.title}": anyone can see it and sign up, without an account.`
            : plan
              ? `A link and QR code for the whole "${plan.name}" page, with all its pictures and PDFs: anyone can see it, without an account. It always shows the plan's latest version.`
              : "A link and QR code for this one picture or PDF: anyone can see it, without an account."
        }
      />
      <Flash msg={sp.msg} tone="warn" />
      <form action={createPublicShare} className="card max-w-2xl space-y-4">
        {signup ? <input type="hidden" name="signup_id" value={signup.id} /> : plan ? <input type="hidden" name="plan_id" value={plan.id} /> : <input type="hidden" name="file" value={file} />}
        {file && <FlyerView file={file} name={sp.title || "Shared"} className="rounded-lg border border-border p-2" />}
        <div>
          <label className="label" htmlFor="sh-title">
            Title
          </label>
          <input id="sh-title" name="title" maxLength={120} className="input" defaultValue={sp.title || signup?.title || plan?.name || ""} placeholder="e.g. Ward Christmas Party" />
        </div>
        <div>
          <label className="label" htmlFor="sh-caption">
            Caption <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea id="sh-caption" name="caption" rows={2} maxLength={500} className="input" defaultValue={sp.caption} placeholder="A line or two shown with it" />
        </div>
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <p className="font-semibold">
            Anyone with the link or QR code can see {signup ? "this service opportunity (but not who signed up)" : plan ? "this whole plan page, including every picture and PDF on it, and any changes you make later" : "this picture or PDF"}.
          </p>
          <p className="mt-1 text-muted">
            They can&apos;t see anything else in the app.{signup ? " People without an account can sign up with their name and phone or email; they confirm with a code." : ""} Don&apos;t share
            pictures with members&apos; faces, names or contact information without permission. You can stop sharing anytime.
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" name="agree" required /> I understand. Make it public.
          </label>
        </div>
        <SubmitButton pendingText="Making the link…">Make the link and QR code</SubmitButton>
      </form>
    </>
  );
}
