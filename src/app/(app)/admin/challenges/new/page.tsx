import { requirePresidency } from "@/lib/auth";
import { DEFAULT_ITEMS } from "@/lib/challenges";
import { hasFeature, orgsInWard } from "@/lib/orgs";
import { todayIn } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { ChallengeForm } from "@/app/(app)/challenges/challenge-form";

export const metadata = { title: "New challenge" };

export default async function NewChallengePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const orgs = orgsInWard(user.ward_id).filter((o) => hasFeature(o, "challenges")).map((o) => ({ id: o.id, name: o.kind === "ward" ? "Whole ward" : o.name }));
  return (
    <>
      <PageHeader title="New challenge" back={{ href: "/admin/challenges", label: "Challenges" }} subtitle="A friendly competition between organizations, all for fun." />
      <Flash msg={sp.msg} tone="warn" />
      <ChallengeForm orgs={orgs.filter((o) => o.name !== "Whole ward")} mine={user.org_id} today={todayIn(user.ward.timezone)} defaults={DEFAULT_ITEMS} />
    </>
  );
}
