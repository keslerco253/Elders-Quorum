import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { invitedMeeting, MEETING_ROLES, meetingAgenda, meetingInvitees } from "@/lib/meetings";
import { getOrg, roleIn } from "@/lib/orgs";
import { withOrg } from "@/lib/org-cookie";
import { formatDate } from "@/lib/time";
import { Badge, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { Linkify } from "@/components/linkify";
import { respondMeeting } from "./actions";

export const metadata = { title: "Meeting" };

/** A meeting someone was invited to: when and where, the agenda, and their answer. */
export default async function InvitedMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const m = invitedMeeting(user.id, id);
  if (!m) {
    // The presidency (who see every meeting on their calendar) manage it instead.
    const org = (db().prepare("SELECT org_id FROM meetings WHERE id = ?").get(id) as { org_id: number } | undefined)?.org_id;
    if (org && roleIn(user.id, org) === "presidency") redirect(withOrg(`/admin/meetings/${id}`, org));
    notFound();
  }
  const org = getOrg(m.org_id);
  const time = m.time ? DateTime.fromFormat(m.time, "HH:mm").toFormat("h:mm a") : null;
  const agenda = meetingAgenda(m.id);
  const invitees = meetingInvitees(m.id);
  const coming = invitees.filter((i) => i.response === "yes").length;
  const leads = roleIn(user.id, m.org_id) === "presidency";
  const answer = (response: "yes" | "no", label: string) => (
    <form action={respondMeeting}>
      <input type="hidden" name="meeting_id" value={m.id} />
      <input type="hidden" name="response" value={response} />
      <SubmitButton className={m.response === response ? "btn-primary" : "btn-secondary"} pendingText="Saving…">
        {m.response === response ? "✓ " : ""}
        {label}
      </SubmitButton>
    </form>
  );

  return (
    <>
      <PageHeader
        title={m.title}
        back={{ href: "/", label: "Home" }}
        subtitle={`${formatDate(m.date)}${time ? ` at ${time}` : ""}${m.location ? ` · ${m.location}` : ""}`}
        actions={
          leads ? (
            <Link href={withOrg(`/admin/meetings/${m.id}`, m.org_id)} className="btn-secondary">
              Manage
            </Link>
          ) : undefined
        }
      />
      <div className="max-w-2xl space-y-5">
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {org && <Badge>{org.kind === "ward" ? "Ward" : org.name}</Badge>}
            {m.held_at && <Badge>Held</Badge>}
            {!m.held_at && !m.response && <Badge tone="warn">Please respond</Badge>}
          </div>
          {!m.held_at && (
            <>
              <p className="text-sm">Can you come?</p>
              <div className="flex flex-wrap gap-2">
                {answer("yes", "I'll be there")}
                {answer("no", "I can't come")}
              </div>
            </>
          )}
          {m.event_id && (
            <Link href={`/calendar/${m.event_id}`} className="link block text-sm">
              Add it to your calendar
            </Link>
          )}
        </div>

        {MEETING_ROLES.some(([k]) => m[k]) && (
          <div className="card space-y-1 text-sm">
            {MEETING_ROLES.filter(([k]) => m[k]).map(([k, label]) => (
              <div key={k}>
                <span className="text-muted">{label}:</span> <span className="font-medium">{m[k]}</span>
                {m[k] === user.display_name && <Badge tone="info">You</Badge>}
              </div>
            ))}
          </div>
        )}

        <Section title="Agenda">
          {agenda.length === 0 ? (
            <p className="text-sm text-muted">The agenda hasn&apos;t been posted yet.</p>
          ) : (
            <ol className="list-decimal space-y-2 rounded-xl border border-border bg-surface py-3 pr-4 pl-9 text-sm">
              {agenda.map((a) => (
                <li key={a.id} className="whitespace-pre-wrap break-words">
                  <Linkify text={a.body} />
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title={`Invited (${invitees.length})`}>
          <p className="mb-2 text-sm text-muted">{coming ? `${coming} coming so far.` : "No answers yet."}</p>
          <p className="text-sm">{invitees.map((i) => i.display_name).join(", ")}</p>
        </Section>
      </div>
    </>
  );
}
