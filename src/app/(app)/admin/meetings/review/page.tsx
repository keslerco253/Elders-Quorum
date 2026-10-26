import Link from "next/link";
import { HandbookLinks } from "@/components/handbook-link";
import { RECORDS } from "@/lib/handbook";
import { requirePresidency } from "@/lib/auth";
import { recordsToReview, type ReviewRecord } from "@/lib/meetings";
import { formatDate, todayIn } from "@/lib/time";
import { Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { reviewAction } from "../actions";

export const metadata = { title: "Records to review" };

const GROUPS: [ReviewRecord["kind"], string][] = [
  ["meeting", "Meeting notes"],
  ["todo", "Finished assignments"],
  ["agenda", "Agenda items waiting a long time"],
];

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const records = recordsToReview(user.org_id, todayIn(user.ward.timezone));
  return (
    <>
      <PageHeader
        title="Records to review"
        back={{ href: "/admin/meetings", label: "Meetings" }}
        subtitle="The handbook asks leaders to keep notes only as long as they're needed. For each one: is it still current? Keep it 3 more months, or delete it."
      />
      <Flash msg={sp.msg} />
      <HandbookLinks chapters={[RECORDS]} />
      {records.length === 0 ? (
        <Empty>Nothing to review. Meeting notes and finished assignments come up here 3 months after the meeting or when they were done.</Empty>
      ) : (
        GROUPS.filter(([k]) => records.some((r) => r.kind === k)).map(([kind, label]) => (
          <Section key={kind} title={label}>
            <ul className="mb-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {records
                .filter((r) => r.kind === kind)
                .map((r) => (
                  <li key={`${r.kind}:${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Link href={r.href} className="min-w-0 flex-1">
                      <span className="block font-medium">{r.title}</span>
                      <span className="text-sm text-muted">{formatDate(r.date, "short")}</span>
                    </Link>
                    <form action={reviewAction} className="flex gap-1">
                      <input type="hidden" name="kind" value={r.kind} />
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton name="decision" value="keep" className="btn-secondary btn-sm" pendingText="…">
                        Keep 3 more months
                      </SubmitButton>
                      <SubmitButton name="decision" value="delete" className="btn-secondary btn-sm" confirm="Delete it for good?" pendingText="…">
                        Delete
                      </SubmitButton>
                    </form>
                  </li>
                ))}
            </ul>
          </Section>
        ))
      )}
    </>
  );
}
