import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { VisitForm } from "../visit-form";
import { getPlannedVisit, visitorIds } from "@/lib/planned-visits";
import { orgRoster } from "@/lib/orgs";
import { orgPresidency } from "@/lib/orgs";

export const metadata = { title: "Record a visit" };

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  // Recording a planned visit: start from what was planned.
  const plan = sp.plan ? getPlannedVisit(user.org_id, Number(sp.plan)) : undefined;
  const members = orgRoster(user.org_id);
  const presidency = orgPresidency(user.org_id);
  return (
    <>
      <PageHeader title="Record a visit" back={{ href: "/admin/visits", label: "Visits" }} />
      <Flash msg={sp.msg} tone={sp.msg?.startsWith("Request marked") || plan ? "success" : "danger"} />
      <VisitForm members={members} presidency={presidency} defaultMember={plan?.member_id ?? (Number(sp.member) || undefined)} defaultVisitors={plan ? visitorIds(plan) : [user.id]} today={todayIn(user.ward.timezone)} planId={plan?.id} defaultDate={plan && plan.date <= todayIn(user.ward.timezone) ? plan.date : undefined} defaultType={plan?.type} />
    </>
  );
}
