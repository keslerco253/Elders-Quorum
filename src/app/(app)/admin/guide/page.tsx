import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { ledOrgsAnywhere } from "@/lib/orgs";
import { PageHeader } from "@/components/ui";
import { GuideView } from "@/components/guide-view";

export const metadata = { title: "Leader guide" };

/** How to use the app as a leader: for anyone in a presidency or bishopric. */
export default async function LeaderGuidePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const q = String((await searchParams).q ?? "").trim().slice(0, 100);
  if (!isAdmin(user) && ledOrgsAnywhere(user.id).length === 0) redirect("/");
  return (
    <>
      <PageHeader title="Leader guide" back={{ href: "/admin", label: "Admin" }} subtitle="How to do everything in the app as a leader. Ask a question or tap a topic." />
      <GuideView kind="leader" q={q} userId={user.id} path="/admin/guide" placeholder="Ask a question, like “How do I turn off texting?”" asksPerHour={40} />
    </>
  );
}
