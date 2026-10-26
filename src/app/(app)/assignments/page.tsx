import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { givenBy, KIND_ICONS, myAssignments, STATUS_LABELS, type MyItem } from "@/lib/assignments";
import { formatDate } from "@/lib/time";
import { getOrg, hasFeature, myOrgs } from "@/lib/orgs";
import { ledOrgIds } from "@/lib/conversations";
import { withOrg } from "@/lib/org-cookie";
import { todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { RemindersLink } from "@/components/reminders-link";
import { SubmitButton } from "@/components/client";
import { deleteTodo } from "../admin/todos/actions";

export const metadata = { title: "My assignments" };

const KIND_WORDS = { todo: "Assignment", mine: "My to-do", teach: "Teaching", serve: "Service" } as const;

/** Everything on a member's plate: assignments from a presidency, lessons they teach, service they signed up for. */
export default async function MyAssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayIn(user.ward.timezone);
  const pastView = sp.view === "past";
  const items = myAssignments(user.id, today, { past: pastView });
  const manyOrgs = myOrgs(user.id).length > 2;
  // Presidency members can give assignments from here too: in the organization they're
  // looking at if they lead it, otherwise the first one they lead.
  const led = ledOrgIds(user.id).filter((id) => {
    const o = getOrg(id);
    return !!o && hasFeature(o, "todos");
  });
  const assignOrg = led.includes(user.org_id) ? user.org_id : led[0];
  // What they've asked others to do (still open), so it doesn't vanish once given.
  const given = assignOrg && !pastView ? givenBy(user.id).filter((t) => led.includes(t.org_id)) : [];

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
      <PageHeader
        title="My assignments"
        back={{ href: "/more", label: "More" }}
        subtitle="What you've been asked to do, the lessons you're teaching, and the service you signed up for."
        actions={
          <div className="flex flex-wrap gap-2">
            <RemindersLink kind="assignments" />
            <Link href="/assignments/mine/new" className={assignOrg ? "btn-secondary" : "btn-primary"}>
              + My to-do
            </Link>
            {assignOrg && (
              <Link href={withOrg("/assignments/new", assignOrg)} className="btn-primary">
                + New assignment
              </Link>
            )}
          </div>
        }
      />
      <Flash msg={sp.msg} />
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
                📋 Assignments come from your presidency: tap one to add a progress note or mark it done. 📝 Your own to-dos are entirely private: only you can see them, no one else. 📖 Lessons you&apos;re teaching show until Sunday; confirm them on the lesson.
                👥 Service you signed up for shows until its date.
              </p>
            </Section>
          </div>
        </>
      )}
      {given.length > 0 && (
        <div className="mt-6">
          <Section
            title="Assignments you've given"
            actions={
              <Link href="/admin/todos" className="link text-sm">
                All assignments
              </Link>
            }
          >
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {given.map((t) => (
                <li key={t.id} className="flex items-center">
                  <Link href={withOrg(`/assignments/${t.id}`, t.org_id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{t.title}</span>
                      <span className="text-sm text-muted">
                        {t.assignee ?? "Unassigned"}
                        {t.due_date && ` · due ${formatDate(t.due_date, "short")}`}
                        {t.note_count > 0 && ` · ${t.note_count} note${t.note_count === 1 ? "" : "s"}`}
                      </span>
                    </span>
                    {t.due_date && t.due_date < today ? <Badge tone="danger">Overdue</Badge> : t.status === "progress" && <Badge tone="info">{STATUS_LABELS.progress}</Badge>}
                    <span className="text-muted">›</span>
                  </Link>
                  <form action={deleteTodo} className="shrink-0 pr-3">
                    <input type="hidden" name="item_id" value={t.id} />
                    <input type="hidden" name="back" value="/assignments" />
                    <SubmitButton className="btn-secondary btn-sm" confirm="Delete this assignment?" pendingText="…">
                      ✕
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </>
  );
}
