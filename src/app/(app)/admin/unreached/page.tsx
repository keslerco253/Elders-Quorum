import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { unreachedItems } from "@/lib/unreached";
import { formatPhone } from "@/lib/contact";
import { formatDateTime } from "@/lib/time";
import { Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { toldThem } from "./actions";

export const metadata = { title: "Couldn't reach" };

/**
 * Things the app couldn't get to someone at all (their notifications are off and they
 * have no email or texts they allow). The whole presidency sees them, so one of you
 * can tell them in person or by phone.
 */
export default async function UnreachedPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  const open = unreachedItems(user.org_id);
  const done = unreachedItems(user.org_id, true);
  return (
    <>
      <PageHeader
        title="Couldn't reach"
        back={{ href: "/admin", label: "Admin" }}
        subtitle="These didn't reach the person at all: their app notifications are off and they have no email or texts turned on. Please tell them in person or by phone, then tap I told them."
      />
      <Flash msg={sp.msg} />
      {open.length === 0 ? (
        <Empty>Nothing waiting. Everything sent lately reached someone.</Empty>
      ) : (
        <ul className="space-y-2">
          {open.map((u) => (
            <li key={u.id} className="card space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {u.member_id ? (
                    <Link href={`/admin/members/${u.member_id}`} className="hover:underline">
                      {u.name ?? "Someone"}
                    </Link>
                  ) : (
                    "Several people"
                  )}
                </span>
                <span className="text-xs text-muted">{formatDateTime(u.created_at, tz, "LLL d, h:mm a")}</span>
              </div>
              <div className="text-sm">
                <Link href={u.url} className="link">
                  {u.what}
                </Link>
              </div>
              {u.detail && <div className="text-sm text-muted">Couldn&apos;t reach: {u.detail}</div>}
              {u.why && <div className="text-xs text-muted">Why: {u.why}.</div>}
              {u.member_id && (u.phone || u.email) && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {u.phone && (
                    <>
                      <a href={`tel:${u.phone}`} className="btn-secondary btn-sm">
                        Call {formatPhone(u.phone)}
                      </a>
                      <a href={`sms:${u.phone}`} className="btn-secondary btn-sm">
                        Text from my phone
                      </a>
                    </>
                  )}
                  {u.email && (
                    <a href={`mailto:${u.email}`} className="btn-secondary btn-sm">
                      Email {u.email}
                    </a>
                  )}
                </div>
              )}
              <form action={toldThem}>
                <input type="hidden" name="item_id" value={u.id} />
                <SubmitButton className="btn-primary btn-sm" pendingText="Saving…">
                  I told them
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <div className="mt-6">
          <Section title="Recently handled">
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface text-sm">
              {done.map((u) => (
                <li key={u.id} className="px-4 py-2">
                  <span className="font-medium">{u.name ?? "Several people"}</span> · {u.what}
                  <span className="block text-xs text-muted">
                    Told by {u.done_by_name ?? "a leader"}, {formatDateTime(u.done_at!, tz, "LLL d")}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </>
  );
}
