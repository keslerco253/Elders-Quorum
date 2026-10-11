import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import type { Member } from "@/lib/types";
import { decideAccess } from "../members/actions";

export const metadata = { title: "Access requests" };

export default async function AccessPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const pending = db().prepare("SELECT * FROM members WHERE ward_id = ? AND status = 'pending' ORDER BY updated_at").all(user.ward_id) as Member[];
  return (
    <>
      <PageHeader title="Access requests" back={{ href: "/admin", label: "Admin" }} subtitle="People who aren't on the LCR list. Part-member family members can be approved at the presidency's discretion." />
      <Flash msg={sp.msg} />
      {pending.length === 0 ? (
        <Empty>No requests waiting.</Empty>
      ) : (
        <div className="space-y-3">
          {pending.map((m) => (
            <div key={m.id} className="card">
              <div className="font-semibold">{m.display_name}</div>
              <div className="text-sm text-muted">
                {[m.email, m.phone].filter(Boolean).join(" · ")} · requested {formatDateTime(m.updated_at, user.ward.timezone, "LLL d")}
              </div>
              {m.request_note && <p className="mt-2 rounded-lg bg-surface-2 p-3 text-sm">{m.request_note}</p>}
              <form action={decideAccess} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={m.id} />
                <SubmitButton name="decision" value="approve">
                  Approve
                </SubmitButton>
                <SubmitButton name="decision" value="decline" className="btn-danger" confirm={`Decline ${m.display_name}'s request?`}>
                  Decline
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
