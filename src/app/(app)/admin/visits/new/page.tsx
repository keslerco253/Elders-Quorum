import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { VisitForm } from "../visit-form";

export const metadata = { title: "Record a visit" };

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const members = db().prepare("SELECT id, display_name FROM members WHERE ward_id = ? AND status = 'active' ORDER BY display_name").all(user.ward_id) as { id: number; display_name: string }[];
  const presidency = db().prepare("SELECT id, display_name FROM members WHERE ward_id = ? AND role = 'presidency' AND status = 'active' ORDER BY display_name").all(user.ward_id) as { id: number; display_name: string }[];
  return (
    <>
      <PageHeader title="Record a visit" back={{ href: "/admin/visits", label: "Visits" }} />
      <Flash msg={sp.msg} tone="danger" />
      <VisitForm members={members} presidency={presidency} defaultMember={Number(sp.member) || undefined} defaultVisitors={[user.id]} today={todayIn(user.ward.timezone)} />
    </>
  );
}
