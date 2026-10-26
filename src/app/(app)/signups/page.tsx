import Link from "next/link";
import { HandbookLinks } from "@/components/handbook-link";
import { TEMPORAL_NEEDS } from "@/lib/handbook";
import { RemindersLink } from "@/components/reminders-link";
import { FlyerThumb } from "@/components/flyer-thumb";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { listSignups, listWardSignups, stillNeeded } from "@/lib/signups";
import { OrgLink } from "@/components/org-link";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "Service" };

export default async function SignupsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const admin = isAdmin(user);
  const all = admin && sp.show === "all";
  // Looking at the ward itself: every organization's service opportunities.
  const wardLevel = user.org.kind === "ward";
  const list: (ReturnType<typeof listSignups>[number] & { org_label?: string })[] = wardLevel
    ? listWardSignups(user.ward_id, all, todayIn(user.ward.timezone))
    : listSignups(user.org_id, all, todayIn(user.ward.timezone));
  return (
    <>
      <PageHeader
        title="Service"
        subtitle={wardLevel ? "Service projects, meals and other ways to serve, from every organization in the ward." : "Service projects, meals and other ways to serve."}
        actions={
          <>
            <RemindersLink kind="service" />
            {admin && (
              <>
                <Link href={all ? "/signups" : "/signups?show=all"} className="btn-secondary">
                  {all ? "Open only" : "Show closed"}
                </Link>
                <Link href="/admin/signups/new" className="btn-primary">
                  New service opportunity
                </Link>
              </>
            )}
          </>
        }
      />
      <Flash msg={sp.msg} />
      <HandbookLinks chapters={[TEMPORAL_NEEDS]} />
      {list.length === 0 ? (
        <Empty>No service opportunities right now.</Empty>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id}>
              <OrgLink href={s.org_id === user.org_id ? `/signups/${s.id}` : `/signups/${s.id}?org=${s.org_id}`} className="card flex items-center gap-3 hover:bg-surface-2">
                {s.flyer_file && <FlyerThumb file={s.flyer_file} name={s.flyer_name} />}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm text-muted">
                    {s.date ? formatDate(s.date) : "No set date"}
                    {s.org_label && s.org_id !== user.org_id && <> · {s.org_label}</>}
                  </div>
                </div>
                {s.closed ? <Badge>Closed</Badge> : s.taken >= s.capacity && s.capacity > 0 ? <Badge tone="success">Full</Badge> : <Badge tone="info">{stillNeeded(s.capacity - s.taken)}</Badge>}
                <span className="text-muted">›</span>
              </OrgLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
