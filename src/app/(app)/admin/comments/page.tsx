import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/time";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { approveAll, decideReport, moderateComment } from "./actions";
import { openReports } from "@/lib/moderation";

export const metadata = { title: "Comments to approve" };

interface Row {
  id: number;
  body: string;
  created_at: string;
  author: string;
  lesson_id: number;
  lesson_date: string;
  lesson_title: string;
  parent_body: string | null;
  parent_author: string | null;
}

export default async function CommentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const rows = db()
    .prepare(
      `SELECT c.id, c.body, c.created_at, m.display_name AS author, l.id AS lesson_id, l.date AS lesson_date, l.title AS lesson_title,
              p.body AS parent_body, pm.display_name AS parent_author
       FROM comments c
       JOIN members m ON m.id = c.member_id
       JOIN lessons l ON l.id = c.lesson_id
       LEFT JOIN comments p ON p.id = c.parent_id
       LEFT JOIN members pm ON pm.id = p.member_id
       WHERE l.org_id = ? AND c.status = 'pending'
       ORDER BY c.created_at`,
    )
    .all(user.org_id) as Row[];
  const reported = openReports(user.org_id);

  return (
    <>
      <PageHeader
        title="Comments to approve"
        back={{ href: "/admin", label: "Admin" }}
        subtitle="Comments and replies show to everyone only after approval."
        actions={
          rows.length > 1 && (
            <form action={approveAll}>
              <SubmitButton className="btn-secondary" confirm={`Approve all ${rows.length} comments?`}>
                Approve all
              </SubmitButton>
            </form>
          )
        }
      />
      <Flash msg={sp.msg} />
      {reported.length > 0 && (
        <section id="reported" className="mb-6 scroll-mt-20">
          <h2 className="mb-2 text-base font-semibold">Reported by members ({reported.length})</h2>
          <p className="mb-3 text-sm text-muted">
            Already hidden for whoever reported it. Hide it from everyone, or keep it. Members can also block someone, so they no longer see that person&apos;s comments.
          </p>
          <div className="space-y-3">
            {reported.map((r) => (
              <div key={r.comment_id} className="card border-warn">
                <div className="text-xs text-muted">
                  <Link href={`/lessons/${r.lesson_id}#comments`} className="link">
                    {formatDate(r.lesson_date, "short")} · {r.lesson_title || "Lesson"}
                  </Link>{" "}
                  · reported {r.reports === 1 ? "once" : `${r.reports} times`}, last {formatDateTime(r.last_at, user.ward.timezone, "LLL d, h:mm a")}
                </div>
                <div className="mt-2 font-semibold">{r.author}</div>
                <p className="mt-1 whitespace-pre-wrap">{r.body}</p>
                {r.reasons && <p className="mt-1 text-sm text-muted">Why: {r.reasons}</p>}
                <form action={decideReport} className="mt-3 flex gap-2">
                  <input type="hidden" name="item_id" value={r.comment_id} />
                  <SubmitButton name="decision" value="hide" className="btn-danger btn-sm">
                    Hide it from everyone
                  </SubmitButton>
                  <SubmitButton name="decision" value="keep" className="btn-secondary btn-sm">
                    Keep it
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
          <h2 className="mt-6 mb-2 text-base font-semibold">Waiting for approval</h2>
        </section>
      )}
      {rows.length === 0 ? (
        <Empty>All caught up. No comments are waiting.</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div key={c.id} className="card">
              <div className="text-xs text-muted">
                <Link href={`/lessons/${c.lesson_id}`} className="link">
                  {formatDate(c.lesson_date, "short")} · {c.lesson_title || "Lesson"}
                </Link>{" "}
                · {formatDateTime(c.created_at, user.ward.timezone, "LLL d, h:mm a")}
              </div>
              {c.parent_body && (
                <p className="mt-2 border-l-2 border-border pl-3 text-sm text-muted">
                  Replying to {c.parent_author}: {c.parent_body.slice(0, 160)}
                  {c.parent_body.length > 160 ? "…" : ""}
                </p>
              )}
              <div className="mt-2 font-semibold">{c.author}</div>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              <form action={moderateComment} className="mt-3 flex gap-2">
                <input type="hidden" name="item_id" value={c.id} />
                <SubmitButton name="decision" value="approve" className="btn-primary btn-sm">
                  Approve
                </SubmitButton>
                <SubmitButton name="decision" value="reject" className="btn-danger btn-sm">
                  Don&apos;t post
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
