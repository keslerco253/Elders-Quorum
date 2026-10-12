import { notFound } from "next/navigation";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/time";
import type { VisitRow } from "@/lib/visits";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { VisitForm } from "../visit-form";
import { deleteVisit } from "../actions";

export const metadata = { title: "Edit visit" };

export default async function EditVisitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const id = Number((await params).id);
  const sp = await searchParams;
  const v = db().prepare("SELECT * FROM visits WHERE id = ? AND ward_id = ?").get(id, user.ward_id) as VisitRow | undefined;
  if (!v) notFound();
  const visitors = (db().prepare("SELECT member_id FROM visit_visitors WHERE visit_id = ?").all(id) as { member_id: number }[]).map((r) => r.member_id);
  const members = db().prepare("SELECT id, display_name FROM members WHERE ward_id = ? AND (status = 'active' OR id = ?) ORDER BY display_name").all(user.ward_id, v.member_id) as { id: number; display_name: string }[];
  const presidency = db()
    .prepare(`SELECT id, display_name FROM members WHERE ward_id = ? AND (role = 'presidency' OR id IN (${visitors.map(() => "?").join(",") || "NULL"})) ORDER BY display_name`)
    .all(user.ward_id, ...visitors) as { id: number; display_name: string }[];
  return (
    <>
      <PageHeader title="Edit visit" back={{ href: `/admin/visits?member=${v.member_id}`, label: "Visits" }} />
      <Flash msg={sp.msg} tone="danger" />
      <VisitForm v={v} members={members} presidency={presidency} defaultVisitors={visitors} today={todayIn(user.ward.timezone)} />
      <form action={deleteVisit} className="mt-4">
        <input type="hidden" name="id" value={v.id} />
        <SubmitButton className="btn-danger btn-sm" confirm="Delete this visit record?">
          Delete visit
        </SubmitButton>
      </form>
    </>
  );
}
