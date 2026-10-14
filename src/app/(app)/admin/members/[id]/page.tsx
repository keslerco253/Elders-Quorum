import Link from "next/link";
import { firstName } from "@/lib/names";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPresidency } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/time";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { callingLabel, CALLINGS, roleLabel } from "@/lib/types";
import { orgMemberView } from "@/lib/orgs";
import { formatPhone } from "@/lib/contact";
import { emailInvite, removeMember, updateMember } from "../actions";
import { inviteLink, inviteText } from "@/lib/invite";
import { phoneEnabled, phoneOptInVisible } from "@/lib/sms";
import { CopyButton } from "@/components/copy-button";

export const metadata = { title: "Member" };

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const m = orgMemberView(user.org_id, Number(id));
  if (!m || (m.status !== "active" && m.status !== "inactive")) notFound();
  const presidency = isPresidency(user);
  const lastVisit = presidency ? (db().prepare("SELECT date FROM visits WHERE member_id = ? AND org_id = ? ORDER BY date DESC LIMIT 1").get(m.id, user.org_id) as { date: string } | undefined) : undefined;
  const otherOrgs = (
    db()
      .prepare("SELECT o.id, o.name, o.kind, om.official FROM org_members om JOIN orgs o ON o.id = om.org_id WHERE om.member_id = ? AND o.ward_id = ? AND o.kind = 'group' AND o.id <> ? ORDER BY o.name")
      .all(m.id, user.ward_id, user.org_id) as { id: number; name: string; official: number }[]
  ).filter((o) => o.official);

  return (
    <>
      <PageHeader
        title={m.display_name}
        back={{ href: "/admin/members", label: "Members" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{m.calling ? callingLabel(m.calling, user.org) : m.in_org ? roleLabel(m.role, user.org) : `Not in ${user.orgLabel}`}</Badge>
            {otherOrgs.map((o) => (
              <Badge key={o.id}>{o.name}</Badge>
            ))}
            {m.status !== "active" && <Badge tone="warn">Turned off</Badge>}
            <span>{m.last_login_at ? `Last signed in ${formatDateTime(m.last_login_at, user.ward.timezone, "LLL d, yyyy")}` : "Hasn't signed in yet"}</span>
          </span>
        }
      />
      <Flash msg={sp.msg} />
      {presidency && !m.welcomed_at && m.status === "active" && (
        <div className="card mb-5 space-y-3 text-sm">
          <div className="font-semibold">Invite {firstName(m.display_name)}</div>
          <p className="text-muted">They haven&apos;t signed in yet. At their first sign-in they&apos;ll agree to what the app keeps and choose whether to get texts.</p>
          {m.phone && (
            <>
              {!phoneEnabled() && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">Texting isn&apos;t live yet, so they can&apos;t sign in with a phone number until it is. Add an email too if they need in sooner.</p>}
              <p className="text-muted">Text them this invite from your own phone (the app won&apos;t text them until they agree):</p>
              <p className="rounded-lg bg-surface-2 px-3 py-2">{inviteText(m, user.ward.name)}</p>
              <div className="flex flex-wrap gap-2">
                <a className="btn-primary btn-sm" href={`sms:${m.phone}?&body=${encodeURIComponent(inviteText(m, user.ward.name))}`}>
                  Text invite
                </a>
                <CopyButton text={inviteText(m, user.ward.name)} />
              </div>
            </>
          )}
          {m.email && (
            <form action={emailInvite}>
              <input type="hidden" name="item_id" value={m.id} />
              <SubmitButton className={m.phone ? "btn-secondary btn-sm" : "btn-primary btn-sm"} pendingText="Sending…">
                Email invite to {m.email}
              </SubmitButton>
            </form>
          )}
          <p className="text-xs break-all text-muted">Sign-in link: {inviteLink(m)}</p>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <form action={updateMember} className="card space-y-4">
          <input type="hidden" name="item_id" value={m.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" required className="input" defaultValue={m.display_name} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="phone">
                Mobile number
              </label>
              <input id="phone" name="phone" type="tel" className="input" defaultValue={formatPhone(m.phone)} />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" className="input" defaultValue={m.email ?? ""} />
            </div>
          </div>
          {m.phone && (
            <p className="hint -mt-2">
              {m.sms_consent_at
                ? `Agreed to ward texts ${formatDateTime(m.sms_consent_at, user.ward.timezone, "LLL d, yyyy")}.`
                : phoneOptInVisible()
                  ? "Hasn't agreed to ward texts, so the app only texts them sign-in codes they ask for. They can agree at first sign-in or under More → Contact & notifications (by choosing Text)."
                  : "Hasn't agreed to ward texts. Texting isn't set up yet."}
            </p>
          )}
          <p className="hint -mt-2">
            Either one can be used to sign in. Change these only to help a member (for example, a new phone number). They get notifications by push
            {m.always_email || (m.always_text && m.sms_consent_at)
              ? `, plus ${[m.always_email ? "email" : "", m.always_text && m.sms_consent_at ? "text" : ""].filter(Boolean).join(" and ")} every time`
              : `, or ${{ text: "text", email: "email", both: "text and email", none: "nothing else" }[m.contact_pref]} if push doesn't reach them`}
            .
          </p>
          {presidency && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="role">
                  Access level
                </label>
                <select id="role" name="role" className="input" defaultValue={m.role}>
                  <option value="member">Member</option>
                  <option value="admin">Admin (can post, schedule and send messages)</option>
                  <option value="presidency">{roleLabel("presidency", user.org)}</option>
                </select>
              </div>
              {user.wardLeader && (
                <div>
                  <label className="label" htmlFor="status">
                    Status
                  </label>
                  <select id="status" name="status" className="input" defaultValue={m.status}>
                    <option value="active">Active: can sign in</option>
                    <option value="inactive">Turned off: can&apos;t sign in</option>
                  </select>
                </div>
              )}
              {m.role !== "member" && (
                <div>
                  <label className="label" htmlFor="calling">
                    Calling
                  </label>
                  <select id="calling" name="calling" className="input" defaultValue={m.calling ?? ""}>
                    <option value="">Not set</option>
                    {CALLINGS[user.org.kind].map((v) => (
                      <option key={v} value={v}>
                        {callingLabel(v, user.org)}
                      </option>
                    ))}
                  </select>
                  <p className="hint">Shown next to their name. Members can message presidency members privately.</p>
                </div>
              )}
            </div>
          )}
          <SubmitButton>Save</SubmitButton>
        </form>
        {presidency && (
          <div className="space-y-3">
            <div className="card text-sm">
              <div className="font-semibold">{user.org.kind === "ward" ? "Bishopric visits" : "Presidency visits"}</div>
              <p className="mt-1 text-muted">{lastVisit ? `Last: ${formatDate(lastVisit.date)}` : "No visits recorded."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/visits/plan?member=${m.id}&invite=1`} className="btn-primary btn-sm">
                  Invite to a home visit
                </Link>
                <Link href={`/admin/visits/new?member=${m.id}`} className="btn-secondary btn-sm">
                  Record a visit
                </Link>
                <Link href={`/admin/visits?member=${m.id}`} className="btn-secondary btn-sm">
                  History
                </Link>
              </div>
            </div>
            {user.org.kind === "ward" ? (
              <form action={removeMember} className="card text-sm">
                <input type="hidden" name="item_id" value={m.id} />
                <div className="font-semibold">Remove from {user.ward.name}</div>
                <p className="mt-1 mb-3 text-muted">
                  Takes them out of the ward and all its organizations. If they aren&apos;t in another ward, their account and everything they posted are deleted. They can join again
                  later with the join code.
                </p>
                <SubmitButton className="btn-danger btn-sm" confirm={`Remove ${m.display_name} from ${user.ward.name}?`}>
                  Remove from ward
                </SubmitButton>
              </form>
            ) : (
              m.in_org === 1 && (
                <form action={removeMember} className="card text-sm">
                  <input type="hidden" name="item_id" value={m.id} />
                  <div className="font-semibold">Remove from {user.orgLabel}</div>
                  <p className="mt-1 mb-3 text-muted">They stay in the ward and can choose {user.orgLabel} again themselves.</p>
                  <SubmitButton className="btn-danger btn-sm" confirm={`Remove ${m.display_name} from ${user.orgLabel}?`}>
                    Remove from {user.orgLabel}
                  </SubmitButton>
                </form>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}
