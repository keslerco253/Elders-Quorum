import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { VisitForm } from "../visit-form";
import { getPlannedVisit, visitorIds } from "@/lib/planned-visits";

export const metadata = { title: "Record a visit" };

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  // Recording a planned visit: start from what was planned.
  const plan = sp.plan ? getPlannedVisit(user.ward_id, Number(sp.plan)) : undefined;
  const members = db().prepare("SELECT id, display_name FROM members WHERE ward_id = ? AND status = 'active' ORDER BY display_name").all(user.ward_id) as { id: number; display_name: string }[];
  const presidency = db().prepare("SELECT id, display_name FROM members WHERE ward_id = ? AND role = 'presidency' AND status = 'active' ORDER BY display_name").all(user.ward_id) as { id: number; display_name: string }[];
  return (
    <>
      <PageHeader title="Record a visit" back={{ href: "/admin/visits", label: "Visits" }} />
      <Flash msg={sp.msg} tone={sp.msg?.startsWith("Request marked") || plan ? "success" : "danger"} />
      <VisitForm members={members} presidency={presidency} defaultMember={plan?.member_id ?? (Number(sp.member) || undefined)} defaultVisitors={plan ? visitorIds(plan) : [user.id]} today={todayIn(user.ward.timezone)} planId={plan?.id} defaultDate={plan && plan.date <= todayIn(user.ward.timezone) ? plan.date : undefined} defaultType={plan?.type} />
    </>
  );
}
