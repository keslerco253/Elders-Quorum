import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { listSignups } from "@/lib/signups";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "Sign-ups" };

export default async function SignupsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const admin = isAdmin(user);
  const all = admin && sp.show === "all";
  const list = listSignups(user.ward_id, all, todayIn(user.ward.timezone));
  return (
    <>
      <PageHeader
        title="Sign-ups"
        subtitle="Service projects, meals and other ways to serve."
        actions={
          admin && (
            <>
              <Link href={all ? "/signups" : "/signups?show=all"} className="btn-secondary">
                {all ? "Open only" : "Show closed"}
              </Link>
              <Link href="/admin/signups/new" className="btn-primary">
                New sign-up
              </Link>
            </>
          )
        }
      />
      <Flash msg={sp.msg} />
      {list.length === 0 ? (
        <Empty>No sign-ups right now.</Empty>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id}>
              <Link href={`/signups/${s.id}`} className="card flex items-center gap-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm text-muted">{s.date ? formatDate(s.date) : "No set date"}</div>
                </div>
                {s.closed ? <Badge>Closed</Badge> : s.taken >= s.capacity && s.capacity > 0 ? <Badge tone="success">Full</Badge> : <Badge tone="info">{s.capacity - s.taken} spots open</Badge>}
                <span className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
