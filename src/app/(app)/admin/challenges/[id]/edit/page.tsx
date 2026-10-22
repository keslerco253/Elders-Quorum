import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { challengeItems, challengeTeams, DEFAULT_ITEMS, getChallenge } from "@/lib/challenges";
import { isPresidencyOf } from "@/lib/assignments";
import { hasFeature, orgsInWard } from "@/lib/orgs";
import { todayIn } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { ChallengeForm } from "@/app/(app)/challenges/challenge-form";

export const metadata = { title: "Edit challenge" };

/** The presidency that started a challenge changes it. */
export default async function EditChallengePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const c = getChallenge(user.ward_id, Number((await params).id));
  if (!c) notFound();
  if (!c.org_id || !isPresidencyOf(user.id, c.org_id)) redirect(`/challenges/${c.id}`);
  const orgs = orgsInWard(user.ward_id)
    .filter((o) => o.kind !== "ward" && hasFeature(o, "challenges"))
    .map((o) => ({ id: o.id, name: o.name }));
  return (
    <>
      <PageHeader title="Edit challenge" back={{ href: `/challenges/${c.id}`, label: c.title }} />
      <Flash msg={sp.msg} tone="warn" />
      <ChallengeForm
        orgs={orgs}
        mine={c.org_id}
        today={todayIn(user.ward.timezone)}
        defaults={DEFAULT_ITEMS}
        existing={{ id: c.id, title: c.title, starts_on: c.starts_on, ends_on: c.ends_on, teams: challengeTeams(c.id), items: challengeItems(c.id) }}
      />
    </>
  );
}
