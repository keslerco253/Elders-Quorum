import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatTime } from "@/lib/time";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { decideEventRequest } from "../events/actions";

export const metadata = { title: "Event requests" };

interface Row {
  id: number;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  display_name: string;
}

export default async function EventRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  const rows = db()
    .prepare("SELECT er.*, m.display_name FROM event_requests er JOIN members m ON m.id = er.member_id WHERE er.org_id = ? AND er.status = 'pending' ORDER BY er.starts_at")
    .all(user.org_id) as Row[];
  return (
    <>
      <PageHeader title="Event requests" back={{ href: "/admin", label: "Admin" }} subtitle="Approving adds the event to the calendar and lets the member know." />
      <Flash msg={sp.msg} />
      {rows.length === 0 ? (
        <Empty>No requests waiting.</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div className="font-semibold">{r.title}</div>
              <div className="text-sm text-muted">
                {formatDateTime(r.starts_at, tz)} – {formatTime(r.ends_at, tz)}
                {r.location && ` · ${r.location}`}
              </div>
              <div className="text-sm text-muted">Requested by {r.display_name}</div>
              {r.description && <p className="mt-2 text-sm whitespace-pre-wrap">{r.description}</p>}
              <form action={decideEventRequest} className="mt-3 space-y-2">
                <input type="hidden" name="item_id" value={r.id} />
                <input name="note" className="input" placeholder="Optional note to the member" />
                <div className="flex gap-2">
                  <SubmitButton name="decision" value="approve" className="btn-primary btn-sm">
                    Approve
                  </SubmitButton>
                  <SubmitButton name="decision" value="decline" className="btn-danger btn-sm">
                    Decline
                  </SubmitButton>
                </div>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
