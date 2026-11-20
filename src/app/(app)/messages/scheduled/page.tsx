import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ledOrgIds } from "@/lib/conversations";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { pendingScheduled } from "@/lib/scheduled-messages";
import { formatDateTime, utcToLocalInput } from "@/lib/time";
import { getOrg, getWard } from "@/lib/orgs";
import { cancelScheduledAction, saveScheduled } from "./actions";

export const metadata = { title: "Scheduled messages" };

/** Messages (and reminders) leaders scheduled, still to go out: change the words or times, or cancel. */
export default async function ScheduledPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  if (!ledOrgIds(user.id).length) redirect("/messages");
  const sp = await searchParams;
  const rows = pendingScheduled(user.id);
  return (
    <>
      <PageHeader title="Scheduled" back={{ href: "/messages?tab=sent", label: "Sent" }} subtitle="Messages and reminders still to go out, in the organizations you lead." />
      <Flash msg={sp.msg} tone={sp.err ? "danger" : "success"} />
      {rows.length === 0 ? (
        <Empty>Nothing scheduled. On New message, choose Send later, or Send it again as a reminder.</Empty>
      ) : (
        <ul className="max-w-2xl space-y-3">
          {rows.map((s) => {
            const tz = getWard(getOrg(s.org_id)?.ward_id ?? 0)?.timezone ?? user.ward.timezone;
            const when = (iso: string) => formatDateTime(iso, tz, "ccc, LLL d 'at' h:mm a");
            const sent = !!s.sent_at;
            return (
              <li key={s.id} className="card space-y-2">
                <div className="text-sm">
                  <strong>To {s.audience_label}</strong>
                  <span className="text-muted"> · by {s.sender_name}</span>
                </div>
                <div className="text-sm">
                  {sent ? (
                    <>
                      Sent {when(s.send_at)}. <strong>Reminder {when(s.reminder_at!)}</strong>
                    </>
                  ) : (
                    <>
                      <strong>Goes out {when(s.send_at)}</strong>
                      {s.reminder_at && <> · reminder {when(s.reminder_at)}</>}
                    </>
                  )}
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-accent">Change it</summary>
                  <form action={saveScheduled} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input name="title" maxLength={120} defaultValue={s.title} className="input" aria-label="Subject" placeholder="Subject (optional)" />
                    <textarea name="body" rows={4} maxLength={2000} required defaultValue={s.body} className="input" aria-label="Message" />
                    {!sent && (
                      <label className="block text-sm">
                        Send it on <input name="send_at" type="datetime-local" required defaultValue={utcToLocalInput(s.send_at, tz)} className="input mt-1 w-auto" />
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="remind" defaultChecked={!!s.reminder_at} /> Send it again as a reminder on
                    </label>
                    <input name="reminder_at" type="datetime-local" defaultValue={s.reminder_at ? utcToLocalInput(s.reminder_at, tz) : ""} className="input w-auto" aria-label="Reminder time" />
                    {sent && <p className="hint">The message already went out; changing the words changes the reminder.</p>}
                    <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                  </form>
                </details>
                {!sent && <p className="line-clamp-3 text-sm whitespace-pre-wrap text-muted">{s.body}</p>}
                <form action={cancelScheduledAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton className="btn-secondary btn-sm" confirm={sent ? "Cancel the reminder?" : "Cancel this message? It won't be sent."} pendingText="…">
                    {sent ? "Cancel the reminder" : "Cancel"}
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
