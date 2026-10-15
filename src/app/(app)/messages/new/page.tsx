import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { composeChoices } from "@/lib/compose";
import { Flash, PageHeader } from "@/components/ui";
import { ComposeForm } from "../compose-form";

export const metadata = { title: "New message" };

export default async function NewMessagePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { orgs, people } = composeChoices(user.id);
  // Members write to their leaders (or a group) from My messages.
  if (!orgs.length) redirect("/messages?tab=mine");
  const valid = [...orgs.flatMap((o) => o.audiences.map((a) => a.value)), ...people.map((p) => p.value)];
  const initial = valid.includes(sp.to ?? "") ? sp.to! : "";
  return (
    <>
      <PageHeader title="New message" back={{ href: "/messages", label: "Messages" }} subtitle="To one person, or to everyone in an organization, its presidency or a group." />
      <Flash msg={sp.msg} tone="warn" />
      <ComposeForm orgs={orgs} people={people} initial={initial} />
      <p className="mt-3 text-sm text-muted">
        Groups (like a committee) are set up under{" "}
        <Link href="/admin/groups" className="link">
          Admin → Message groups
        </Link>
        .
      </p>
    </>
  );
}
