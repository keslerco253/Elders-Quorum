"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/client";
import { ChatBox } from "@/components/chat-box";
import type { OrgChoices, PersonChoice } from "@/lib/compose";
import { composeMessage } from "./compose-actions";

const PERSON = "person";

/** One place to write any message: to one person, or to a whole organization, its presidency or a group. */
export function ComposeForm({
  orgs,
  people,
  initial,
  agendaOrgs = [],
  phoneOrgs = [],
  initialTitle = "",
  initialBody = "",
}: {
  orgs: OrgChoices[];
  people: PersonChoice[];
  initial: string;
  agendaOrgs?: number[];
  /** Organizations whose ward lets leaders text from their own phone. */
  phoneOrgs?: number[];
  /** Filled in from elsewhere (e.g. something from ward council to pass on). */
  initialTitle?: string;
  initialBody?: string;
}) {
  const startPerson = initial.startsWith("person:");
  const [to, setTo] = useState(startPerson ? PERSON : initial || orgs[0]?.audiences[0]?.value || "");
  const [person, setPerson] = useState(startPerson ? initial : "");
  const isPerson = to === PERSON;
  const manyOrgs = orgs.length > 1;
  // Presidency members can put what they're writing about on the next meeting's agenda.
  const chosen = isPerson ? person : to;
  const canAgenda = agendaOrgs.includes(Number(chosen.split(":")[1]));
  const canPhone = !!chosen && phoneOrgs.includes(Number(chosen.split(":")[1]));
  // Send now or later, and maybe again as a reminder.
  const [later, setLater] = useState(false);
  const [remind, setRemind] = useState(false);
  return (
    <form action={composeMessage} className="card max-w-2xl space-y-4">
      <input type="hidden" name="to" value={isPerson ? person : to} />
      <div>
        <label className="label" htmlFor="compose-to">
          To
        </label>
        <select id="compose-to" className="input" value={to} onChange={(e) => setTo(e.target.value)} required>
          <option value={PERSON}>One person…</option>
          {orgs.map((o) => (
            <optgroup key={o.orgId} label={manyOrgs ? o.label : "Groups of people"}>
              {o.audiences.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} ({a.count})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {isPerson && (
        <div>
          <label className="label" htmlFor="compose-person">
            Person
          </label>
          <select id="compose-person" className="input" value={person} onChange={(e) => setPerson(e.target.value)} required>
            <option value="">Choose someone…</option>
            {people.map((p) => (
              <option key={p.value} value={p.value}>
                {p.name}
                {manyOrgs ? ` (${p.orgLabel})` : ""}
              </option>
            ))}
          </select>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="private" /> Private: only you can see it in the app (not the rest of the presidency)
          </label>
        </div>
      )}
      {canPhone && (
        <div className="rounded-lg bg-surface-2 p-3">
          {/* Opens the list (with this message) to text from the leader's own phone instead. */}
          <button
            type="button"
            className="btn-secondary"
            onClick={(e) => {
              const body = (e.currentTarget.form?.elements.namedItem("body") as HTMLTextAreaElement | null)?.value ?? "";
              window.location.href = `/messages/phone?${new URLSearchParams({ to: chosen, body })}`;
            }}
          >
            📱 Text from my phone
          </button>
          <p className="mt-1 text-xs text-muted">Free: choose who it&apos;s for above, then tap this. Your phone&apos;s Messages app sends it from your own number, as one group text or one person at a time (you can write the message on the next page). It isn&apos;t sent or saved in the app.</p>
        </div>
      )}
      {!isPerson && (
        <div>
          <label className="label" htmlFor="compose-title">
            Subject <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="compose-title" name="title" maxLength={120} className="input" placeholder="e.g. Service project Saturday" defaultValue={initialTitle} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="compose-body">
          Message
        </label>
        <ChatBox id="compose-body" name="body" rows={5} maxLength={2000} required={isPerson} className="input" draftKey="compose" defaultValue={initialBody || undefined} placeholder="Write your message… (Ctrl+Enter to send)" />
      </div>
      {!isPerson && (
        <div>
          <label className="label" htmlFor="compose-flyer">
            Attach a flyer <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="compose-flyer" name="flyer" type="file" accept="application/pdf,image/*" className="input py-1.5" />
          <p className="hint">A PDF or picture. It shows with the message in the app and comes with the email; texts get a link to see it.</p>
        </div>
      )}
      {!isPerson && (
        <div>
          <label className="label" htmlFor="compose-link">
            Add a button to
          </label>
          <select id="compose-link" name="link" className="input">
            <option value="/">No button</option>
            <option value="/lessons">Lessons</option>
            <option value="/calendar">Calendar</option>
            <option value="/plans">Plans</option>
            <option value="/signups">Service</option>
          </select>
        </div>
      )}
      {canAgenda && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agenda" className="mt-1" defaultChecked={chosen.endsWith(":presidency")} key={chosen.endsWith(":presidency") ? "p" : "o"} />
          <span>
            Add to the next presidency meeting&apos;s agenda
            <span className="block text-xs text-muted">The message goes on the agenda so it&apos;s discussed at the next meeting.</span>
          </span>
        </label>
      )}
      {!isPerson && (
        <fieldset className="space-y-2 rounded-lg bg-surface-2 p-3">
          <legend className="sr-only">When</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="when" value="now" checked={!later} onChange={() => setLater(false)} /> Send now
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="when" value="later" checked={later} onChange={() => setLater(true)} /> Send later
            </label>
          </div>
          {later && (
            <div>
              <label className="label" htmlFor="compose-send-at">
                Send it on
              </label>
              <input id="compose-send-at" name="send_at" type="datetime-local" required className="input w-auto" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="remind" checked={remind} onChange={() => setRemind(!remind)} /> Send it again as a reminder
          </label>
          {remind && (
            <div>
              <label className="label" htmlFor="compose-reminder-at">
                Reminder on
              </label>
              <input id="compose-reminder-at" name="reminder_at" type="datetime-local" required className="input w-auto" />
              <p className="hint">The same message, titled &ldquo;Reminder: …&rdquo;, to the same people (whoever is in the group then).</p>
            </div>
          )}
          {(later || remind) && <p className="hint">Change or cancel it until then under Messages → Scheduled.</p>}
        </fieldset>
      )}
      <p className="text-xs text-muted">
        {isPerson
          ? "They get just your words, signed with your name, as a notification (or by text or email, as they chose). It opens your conversation with them."
          : "Sent as a notification, or by text or email as each person chose. The number shows how many people get it. They can reply, and replies come to your inbox."}
      </p>
      <SubmitButton pendingText={later && !isPerson ? "Scheduling…" : "Sending…"} {...(isPerson ? {} : { confirm: later ? "Schedule this for everyone you chose?" : "Send this to everyone you chose?" })}>
        {later && !isPerson ? "Schedule" : "Send"}
      </SubmitButton>
    </form>
  );
}
