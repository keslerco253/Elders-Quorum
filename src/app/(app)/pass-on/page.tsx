import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { Linkify } from "@/components/linkify";
import { ForwardForm } from "@/components/forward-form";
import { forwardTargets, handlesBackup, messagesNeedingHome } from "@/lib/message-routing";
import { getOrg, orgLabel } from "@/lib/orgs";
import { formatDateTime } from "@/lib/time";
import { forwardMemberMessage, markHandled } from "./actions";

export const metadata = { title: "Pass it on" };

/** For the ward's backup person (and the bishopric): members' messages no organization could receive. */
export default async function PassOnPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  if (!handlesBackup(user)) redirect("/");
  const sp = await searchParams;
  const waiting = messagesNeedingHome(user.ward_id);
  const targets = forwardTargets(user.ward_id);
  return (
    <>
      <PageHeader
        title="Pass it on"
        back={{ href: "/admin", label: "Admin" }}
        subtitle="Members' messages to an organization that couldn't receive them (turned off, or nobody in its presidency). Forward each to the right organization or leader."
      />
      <Flash msg={sp.msg} tone="success" />
      {waiting.length === 0 ? (
        <Empty>Nothing waiting. Thank you!</Empty>
      ) : (
        <ul className="max-w-2xl space-y-3">
          {waiting.map((m) => (
            <li key={m.id} className="card space-y-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{m.member_name}</span>
                <span className="text-xs text-muted">
                  To {orgLabel(getOrg(m.org_id)!)} · {m.via === "text" ? "by text" : "in the app"} · {formatDateTime(m.created_at, user.ward.timezone, "LLL d, h:mm a")}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words">
                <Linkify text={m.body} />
              </p>
              {targets.length ? (
                <ForwardForm messageId={m.id} targets={targets} action={forwardMemberMessage} back="/pass-on" open />
              ) : (
                <p className="text-xs text-muted">No organization has a presidency to forward to yet.</p>
              )}
              <form action={markHandled}>
                <input type="hidden" name="message_id" value={m.id} />
                <SubmitButton className="text-xs text-muted hover:text-text" pendingText="…">
                  I took care of it another way
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
