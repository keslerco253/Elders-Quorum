import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSignup } from "@/lib/signups";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SignupForm } from "../signup-form";
import { announceChoices, wardPeople, withSameAsBefore } from "@/lib/announce";
import { deleteSignup } from "../actions";

export const metadata = { title: "Edit service opportunity" };

export default async function EditSignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requireAdmin();
  const s = getSignup(user.org_id, Number((await params).id));
  if (!s) notFound();
  const sp = await searchParams;
  const people = wardPeople(user.ward_id);
  return (
    <>
      <PageHeader
        title="Edit service opportunity"
        back={{ href: `/signups/${s.id}`, label: s.title }}
      />
      <Flash msg={sp.msg} tone="danger" />
      <SignupForm
        s={s}
        announceTo={withSameAsBefore(
          announceChoices(user, [
            { value: "signed", label: "Everyone signed up for it" },
          ]),
          s.announced_to,
          people,
        )}
        people={people}
      />
      <form action={deleteSignup} className="mt-4">
        <input type="hidden" name="item_id" value={s.id} />
        <SubmitButton
          className="btn-danger btn-sm"
          confirm="Delete this service opportunity and everyone's spots?"
        >
          Delete service opportunity
        </SubmitButton>
      </form>
    </>
  );
}
