import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { KIND_ICONS, myAssignments, type MyItem } from "@/lib/assignments";
import { myOrgs } from "@/lib/orgs";
import { todayIn } from "@/lib/time";
import { Badge, Empty, PageHeader, Section } from "@/components/ui";

export const metadata = { title: "My assignments" };

const KIND_WORDS = { todo: "Assignment", teach: "Teaching", serve: "Service" } as const;

/** Everything on a member's plate: assignments from a presidency, lessons they teach, service they signed up for. */
export default async function MyAssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayIn(user.ward.timezone);
  const pastView = sp.view === "past";
  const items = myAssignments(user.id, today, { past: pastView });
  const manyOrgs = myOrgs(user.id).length > 2;

  const list = (rows: MyItem[]) => (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {rows.map((i) => (
        <li key={i.key}>
          <Link href={i.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
            <span className="text-xl" aria-hidden>
              {KIND_ICONS[i.kind]}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block font-medium ${i.done && i.kind === "todo" ? "text-muted" : ""}`}>{i.title}</span>
              <span className="text-sm text-muted">
                {KIND_WORDS[i.kind]} · {i.detail}
                {manyOrgs && i.orgLabel && ` · ${i.orgLabel}`}
              </span>
            </span>
            {i.flag && <Badge tone={i.flag.tone}>{i.flag.text}</Badge>}
            <span className="text-muted">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader title="My assignments" back={{ href: "/more", label: "More" }} subtitle="What you've been asked to do, the lessons you're teaching, and the service you signed up for." />
      <div className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
        {[
          [false, "/assignments", "Coming up"],
          [true, "/assignments?view=past", "Done and past"],
        ].map(([past, href, label]) => (
          <Link key={String(href)} href={String(href)} className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${pastView === past ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"}`}>
            {label}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty>
          {pastView ? (
            "Nothing here yet."
          ) : (
            <>
              Nothing on your list right now. Look for{" "}
              <Link href="/signups" className="link">
                ways to serve
              </Link>{" "}
              or{" "}
              <Link href="/lessons" className="link">
                offer to teach
              </Link>
              .
            </>
          )}
        </Empty>
      ) : pastView ? (
        list(items)
      ) : (
        <>
          {list(items)}
          <div className="mt-6">
            <Section title="How this list works">
              <p className="text-sm text-muted">
                📋 Assignments come from your presidency: tap one to add a progress note or mark it done. 📖 Lessons you&apos;re teaching show until Sunday; confirm them on the lesson.
                🛠️ Service you signed up for shows until its date.
              </p>
            </Section>
          </div>
        </>
      )}
    </>
  );
}
