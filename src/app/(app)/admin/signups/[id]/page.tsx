import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSignup } from "@/lib/signups";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SignupForm } from "../signup-form";
import { deleteSignup } from "../actions";

export const metadata = { title: "Edit sign-up" };

export default async function EditSignupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const s = getSignup(user.org_id, Number((await params).id));
  if (!s) notFound();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Edit sign-up" back={{ href: `/signups/${s.id}`, label: s.title }} />
      <Flash msg={sp.msg} tone="danger" />
      <SignupForm s={s} />
      <form action={deleteSignup} className="mt-4">
        <input type="hidden" name="item_id" value={s.id} />
        <SubmitButton className="btn-danger btn-sm" confirm="Delete this sign-up and everyone's spots?">
          Delete sign-up
        </SubmitButton>
      </form>
    </>
  );
}
