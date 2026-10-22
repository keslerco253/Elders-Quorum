import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ledOrgsAnywhere } from "@/lib/orgs";
import { isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { GuideView } from "@/components/guide-view";

export const metadata = { title: "Help" };

/** How to use the app, for everyone: only what members can see and do. */
export default async function HelpPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const q = String((await searchParams).q ?? "").trim().slice(0, 100);
  const leads = isAdmin(user) || ledOrgsAnywhere(user.id).length > 0;
  return (
    <>
      <PageHeader title="Help" back={{ href: "/more", label: "More" }} subtitle="How to use the app. Ask a question or tap a topic." />
      {leads && (
        <p className="mb-4 text-sm text-muted">
          This is the members&apos; guide. Leader tools are in the{" "}
          <Link href="/admin/guide" className="link">
            Leader guide
          </Link>
          .
        </p>
      )}
      <GuideView kind="member" q={q} userId={user.id} path="/more/help" placeholder="Ask a question, like “How do I stop getting texts?”" asksPerHour={20} />
    </>
  );
}
