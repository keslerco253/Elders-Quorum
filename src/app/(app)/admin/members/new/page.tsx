import { requireAdmin } from "@/lib/auth";
import { isPresidency } from "@/lib/permissions";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createMember } from "../actions";
import { ContactFields, RoleSelect } from "../member-form";

export const metadata = { title: "Add member" };

export default async function NewMemberPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Add member" back={{ href: "/admin/members", label: "Members" }} subtitle="For someone not in the LCR list yet, or a part-member family member the presidency invites." />
      <Flash msg={sp.msg} tone="danger" />
      <form action={createMember} className="card max-w-2xl space-y-4">
        <ContactFields />
        {isPresidency(user) && <RoleSelect />}
        <SubmitButton>Add member</SubmitButton>
      </form>
    </>
  );
}
