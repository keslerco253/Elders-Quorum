import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { getSignup } from "@/lib/signups";
import { formatDate } from "@/lib/time";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { leaveSlot, takeSlot } from "../actions";

export const metadata = { title: "Sign-up" };

export default async function SignupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const s = getSignup(user.org_id, Number((await params).id));
  if (!s) notFound();
  const sp = await searchParams;
  const admin = isAdmin(user);
  return (
    <>
      <PageHeader
        title={s.title}
        back={{ href: "/signups", label: "Sign-ups" }}
        subtitle={s.date ? formatDate(s.date) : undefined}
        actions={
          isAdmin(user) && (
            <Link href={`/admin/signups/${s.id}`} className="btn-secondary">
              Edit
            </Link>
          )
        }
      />
      <Flash msg={sp.msg} />
      {!!s.closed && <p className="mb-4 rounded-lg bg-surface-2 px-4 py-3 text-sm">This sign-up is closed.</p>}
      {s.description && <p className="card mb-4 whitespace-pre-wrap">{s.description}</p>}
      <ul className="space-y-3">
        {s.slots.map((sl) => {
          const mine = sl.entries.some((e) => e.member_id === user.id);
          const full = sl.entries.length >= sl.capacity;
          return (
            <li key={sl.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{sl.label}</div>
                <Badge tone={full ? "success" : "info"}>
                  {sl.entries.length} of {sl.capacity}
                  {full ? " · full" : ""}
                </Badge>
              </div>
              {sl.entries.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {sl.entries.map((e) => (
                    <li key={e.member_id} className="flex items-center justify-between gap-2">
                      <span>
                        {e.display_name}
                        {e.member_id === user.id && <span className="text-muted"> (you)</span>}
                        {e.note && <span className="text-muted"> · {e.note}</span>}
                      </span>
                      {(e.member_id === user.id || admin) && (
                        <form action={leaveSlot}>
                          <input type="hidden" name="slot_id" value={sl.id} />
                          {e.member_id !== user.id && <input type="hidden" name="member_id" value={e.member_id} />}
                          <SubmitButton className="btn-secondary btn-sm" pendingText="Removing…" confirm={e.member_id === user.id ? "Remove yourself from this spot?" : `Remove ${e.display_name}?`}>
                            ✕ Remove
                          </SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!s.closed &&
                (mine ? (
                  <p className="mt-3 text-sm text-success">✓ You&apos;re signed up for this. Use ✕ Remove next to your name to cancel.</p>
                ) : (
                  !full && (
                    <form action={takeSlot} className="mt-3 flex flex-wrap gap-2">
                      <input type="hidden" name="slot_id" value={sl.id} />
                      <input name="note" maxLength={200} placeholder="Note (optional)" className="input max-w-xs flex-1" />
                      <SubmitButton className="btn-primary btn-sm">Sign me up</SubmitButton>
                    </form>
                  )
                ))}
            </li>
          );
        })}
      </ul>
    </>
  );
}
