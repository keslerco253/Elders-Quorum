import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { audienceMembers, type Audience } from "@/lib/notify";
import { formatDateTime } from "@/lib/time";
import { Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { sendMessage } from "./actions";
import { roleLabel } from "@/lib/types";
import { hasFeature } from "@/lib/orgs";
import { sendableGroups } from "@/lib/groups";

export const metadata = { title: "Send a message" };

interface Msg {
  id: number;
  audience_label: string;
  title: string;
  body: string;
  push_count: number;
  email_count: number;
  text_count: number;
  created_at: string;
  sender: string | null;
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const w = user.org_id;
  const tz = user.ward.timezone;
  const groups = sendableGroups(user);
  const options: [Audience, string][] = [
    ["everyone", `Everyone in ${user.orgLabel} (who gets its notifications)`],
    ["presidency", roleLabel("presidency", user.org)],
    ...(hasFeature(user.org, "lessons") ? [["teachers", "Upcoming teachers (next 5 weeks)"] as [Audience, string]] : []),
    ...groups.map((g): [Audience, string] => [`group:${g.id}`, `Group: ${g.name}`]),
  ];
  const history = db()
    .prepare("SELECT msg.*, m.display_name AS sender FROM messages msg LEFT JOIN members m ON m.id = msg.sender_id WHERE msg.org_id = ? ORDER BY msg.id DESC LIMIT 30")
    .all(w) as Msg[];

  return (
    <>
      <PageHeader title="Send a message" back={{ href: "/admin", label: "Admin" }} subtitle="Sent as a push notification. Members without notifications turned on get it by email or text, as they chose." />
      <Flash msg={sp.msg} />
      <form action={sendMessage} className="card mb-6 max-w-2xl space-y-4">
        <div>
          <label className="label" htmlFor="audience">
            Send to
          </label>
          <select id="audience" name="audience" className="input" required defaultValue={options.some(([v]) => v === sp.to) ? sp.to : "everyone"}>
            {options.map(([v, label]) => (
              <option key={v} value={v}>
                {label} ({audienceMembers(w, v, { tz }).length})
              </option>
            ))}
          </select>
          <p className="hint">
            Numbers show how many people will receive it.{" "}
            <Link href="/admin/groups" className="link">
              Manage groups
            </Link>
          </p>
        </div>
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input id="title" name="title" required maxLength={120} className="input" placeholder="e.g. Service project Saturday" />
        </div>
        <div>
          <label className="label" htmlFor="body">
            Message
          </label>
          <textarea id="body" name="body" required rows={4} maxLength={2000} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="link">
            Add a button to
          </label>
          <select id="link" name="link" className="input">
            <option value="/">No button</option>
            <option value="/lessons">Lessons</option>
            <option value="/calendar">Calendar</option>
            <option value="/plans">Plans</option>
            <option value="/signups">Service</option>
          </select>
          <p className="mt-1 text-xs text-muted">Tapping the notification opens the message in the app, where members can reply to the presidency. Text replies come back to the presidency too.</p>
        </div>
        <SubmitButton pendingText="Sending…" confirm="Send this message now?">
          Send
        </SubmitButton>
      </form>

      <Section title="Sent messages">
        {history.length === 0 ? (
          <p className="text-sm text-muted">Nothing sent yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((m) => (
              <li key={m.id} className="card text-sm">
                <div className="font-semibold">{m.title}</div>
                <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                <div className="mt-2 text-xs text-muted">
                  {formatDateTime(m.created_at, tz)} · {m.audience_label} · {m.sender} · {m.push_count} push, {m.email_count} email, {m.text_count} text
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
