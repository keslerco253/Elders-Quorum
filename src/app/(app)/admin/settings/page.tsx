import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { saveMemberMessages, saveOrgSettings } from "./actions";
import { db } from "@/lib/db";
import { leadersWord } from "@/lib/types";
import { ReminderTimes } from "./reminder-times";
import { OrgEmail } from "./org-email";
import { hasFeature } from "@/lib/orgs";
import { messageLead } from "@/lib/reply-notify";
import { FEATURES, type Feature } from "@/lib/types";

import { monthlyLimit, phoneEnabled, textsThisMonth } from "@/lib/sms";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const mine = db().prepare("SELECT member_messages, msg_notify, msg_summary FROM org_members WHERE org_id = ? AND member_id = ?").get(user.org_id, user.id) as
    | { member_messages: number; msg_notify: string; msg_summary: number }
    | undefined;
  const myMessages = !!mine?.member_messages;
  const presidency = db()
    .prepare("SELECT m.id, m.display_name FROM org_members om JOIN members m ON m.id = om.member_id WHERE om.org_id = ? AND om.role = 'presidency' ORDER BY m.display_name")
    .all(user.org_id) as { id: number; display_name: string }[];
  const chosenLead = (db().prepare("SELECT message_lead_id FROM orgs WHERE id = ?").get(user.org_id) as { message_lead_id: number | null }).message_lead_id;
  const lead = chosenLead ? null : messageLead(user.org_id);
  return (
    <>
      <PageHeader title="Settings" back={{ href: "/admin", label: "Admin" }} />
      <Flash msg={sp.msg} />
      <Section title={user.org.kind === "ward" ? "Features" : "This organization"}>
        <form action={saveOrgSettings} className="card max-w-xl space-y-4">
          {user.org.kind === "group" && (
            <div>
              <label className="label" htmlFor="org-name">
                Name
              </label>
              <input id="org-name" name="name" required maxLength={60} className="input" defaultValue={user.org.name} />
            </div>
          )}
          <fieldset>
            <legend className="label">What {user.orgLabel} uses</legend>
            <div className="space-y-1">
              {(Object.keys(FEATURES) as Feature[]).map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`feature_${f}`} defaultChecked={hasFeature(user.org, f)} /> {FEATURES[f]}
                </label>
              ))}
            </div>
            <p className="hint">Turned-off features are hidden from everyone in {user.orgLabel}. Nothing is deleted, and turning one back on brings it all back. Messages from members and reminder times are below.</p>
          </fieldset>
          <SubmitButton>Save</SubmitButton>
        </form>
        {!user.wardAdmin && (
          <p className="mt-3 max-w-xl text-sm text-muted">The ward&apos;s join code, time zone and list of organizations are managed by its ward administrators.</p>
        )}
      </Section>
      <Section title={user.org.kind === "ward" ? "Ward email" : "Email"}>
        <OrgEmail orgId={user.org_id} wardId={user.ward_id} isWard={user.org.kind === "ward"} back="settings" />
      </Section>
      <Section title="Messages from members">
        <form action={saveMemberMessages} className="card max-w-xl space-y-3 text-sm">
          {!user.ward.member_messages && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">Members&apos; messages are turned off for the whole ward (Ward settings), so these don&apos;t apply right now.</p>
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" name="org_messages" className="mt-1" defaultChecked={!!user.org.member_messages} />
            <span>
              <strong>Members can write to the {leadersWord(user.org)}</strong>
              <span className="block text-muted">
                Off: {user.orgLabel} only sends information out. Members can&apos;t start a message to the {leadersWord(user.org)} or reply, and texted replies aren&apos;t passed on.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="my_messages" className="mt-1" defaultChecked={myMessages} />
            <span>
              <strong>Members can message me</strong>
              <span className="block text-muted">
                Off: members can&apos;t write to you privately, and you aren&apos;t notified of their messages to the {leadersWord(user.org)} (you can still read them in the Inbox).
                If everyone in the {leadersWord(user.org)} turns this off, members can&apos;t write to the {leadersWord(user.org)} at all.
              </span>
            </span>
          </label>
          <fieldset className="space-y-1">
            <legend className="font-semibold">When a member writes or texts back, notify me about</legend>
            {(
              [
                ["mine", "Only ones for me", "Replies to what I sent (a message, an event, an assignment, a lesson I'm conducting). Ones with no clear sender go to the message lead."],
                ["all", "Every member message", `Every message to the ${leadersWord(user.org)}.`],
                ["none", "None", "I'll check Messages myself."],
              ] as const
            ).map(([v, label, hint]) => (
              <label key={v} className="flex items-start gap-2">
                <input type="radio" name="msg_notify" value={v} className="mt-1" defaultChecked={(mine?.msg_notify ?? "mine") === v} />
                <span>
                  <strong>{label}</strong>
                  <span className="block text-muted">{hint}</span>
                </span>
              </label>
            ))}
            <p className="hint">Everyone in the {leadersWord(user.org)} still sees every message in Messages. Private messages to you always notify you unless you pick None.</p>
          </fieldset>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="msg_summary" className="mt-1" defaultChecked={!!mine?.msg_summary} />
            <span>
              <strong>Evening summary</strong>
              <span className="block text-muted">One notification about 8 PM if member messages are still waiting for an answer. Off unless you turn it on.</span>
            </span>
          </label>
          {presidency.length > 1 && (
            <div>
              <label className="label" htmlFor="message-lead">
                Message lead
              </label>
              <select id="message-lead" name="message_lead" className="input" defaultValue={chosenLead ?? ""}>
                <option value="">The president{lead ? ` (${presidency.find((p) => p.id === lead)?.display_name ?? ""})` : ""}</option>
                {presidency.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
              <p className="hint">Gets the messages that aren&apos;t a reply to anyone in particular. Shared by the whole {leadersWord(user.org)}.</p>
            </div>
          )}
          <SubmitButton className="btn-secondary btn-sm">Save</SubmitButton>
        </form>
      </Section>
      <ReminderTimes org={user.org} />
      {user.wardAdmin && (
        <p className="mt-6 max-w-xl text-sm text-muted">
          The ward&apos;s organizations, join code and other ward settings are under{" "}
          <Link href="/ward-settings" className="link">
            Admin → Ward settings
          </Link>
          .
        </p>
      )}
      {phoneEnabled() && (
        <Section title="Texting">
          <div className="card max-w-xl space-y-2 text-sm">
            {user.ward.texting_enabled ? (
              <p>
                This month in {user.ward.name}: <strong>{textsThisMonth(user.ward_id, "notice") + textsThisMonth(user.ward_id, "reply")}</strong> of {monthlyLimit(user.ward_id)} reminder
                and message texts.
              </p>
            ) : (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">
                Reminder and message texts are off for {user.ward.name}. Sign-in codes are still texted, and everything else goes by notification and email.
              </p>
            )}
            <p className="text-muted">Texting and its monthly limit are set by the app&apos;s site owner. At the limit, texts pause until next month and members get email instead.</p>
          </div>
        </Section>
      )}
    </>
  );
}
