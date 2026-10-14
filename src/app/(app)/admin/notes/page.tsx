import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate, formatDateTime } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { reviewNotes } from "./actions";

export const metadata = { title: "Teacher notes to approve" };

interface Row {
  lesson_id: number;
  body: string;
  published_body: string | null;
  updated_at: string;
  author: string | null;
  date: string;
  title: string;
}

export default async function NotesQueuePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const rows = db()
    .prepare(
      `SELECT n.lesson_id, n.body, n.published_body, n.updated_at, m.display_name AS author, l.date, l.title
       FROM lesson_notes n JOIN lessons l ON l.id = n.lesson_id LEFT JOIN members m ON m.id = n.author_id
       WHERE l.org_id = ? AND n.status = 'pending' ORDER BY l.date`,
    )
    .all(user.org_id) as Row[];

  return (
    <>
      <PageHeader
        title="Teacher notes to approve"
        back={{ href: "/admin", label: "Admin" }}
        subtitle="Approving shares the notes on the lesson page. The first approval for a lesson also sends everyone a notification."
      />
      <Flash msg={sp.msg} />
      {rows.length === 0 ? (
        <Empty>No notes waiting.</Empty>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.lesson_id} className="card">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <Link href={`/lessons/${r.lesson_id}`} className="link">
                  {formatDate(r.date, "short")} · {r.title || "Lesson"}
                </Link>
                <span>
                  · from {r.author ?? "the teacher"} · {formatDateTime(r.updated_at, user.ward.timezone, "LLL d, h:mm a")}
                </span>
                {r.published_body ? <Badge tone="info">Edit to notes already shared</Badge> : <Badge tone="warn">New, sends a notification</Badge>}
              </div>
              <div className="prose-eq mt-3 rounded-lg bg-surface-2 p-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.body) }} />
              <form action={reviewNotes} className="mt-3 space-y-2">
                <input type="hidden" name="lesson_id" value={r.lesson_id} />
                <input name="note" maxLength={500} className="input" placeholder="Note to the teacher (only used if you send it back)" />
                <div className="flex gap-2">
                  <SubmitButton name="decision" value="approve" className="btn-primary btn-sm" pendingText="Approving…">
                    Approve and share
                  </SubmitButton>
                  <SubmitButton name="decision" value="reject" className="btn-secondary btn-sm">
                    Send back to teacher
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
