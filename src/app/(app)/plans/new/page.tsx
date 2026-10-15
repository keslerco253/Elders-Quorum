import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canCreatePlans } from "@/lib/plans";
import { Flash, PageHeader } from "@/components/ui";
import { PlanForm } from "../plan-form";
import { createPlanAction } from "../actions";

export const metadata = { title: "New plan" };

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  if (!canCreatePlans(user)) redirect("/plans");
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="New plan" back={{ href: "/plans", label: "Plans" }} subtitle="For the whole ward, or just the organizations it's about." />
      <Flash msg={sp.msg} tone="danger" />
      <PlanForm user={user} action={createPlanAction} />
    </>
  );
}
