"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/client";
import { ChatBox } from "@/components/chat-box";
import type { OrgChoices, PersonChoice } from "@/lib/compose";
import { composeMessage } from "./compose-actions";

const PERSON = "person";

/** One place to write any message: to one person, or to a whole organization, its presidency or a group. */
export function ComposeForm({ orgs, people, initial }: { orgs: OrgChoices[]; people: PersonChoice[]; initial: string }) {
  const startPerson = initial.startsWith("person:");
  const [to, setTo] = useState(startPerson ? PERSON : initial || orgs[0]?.audiences[0]?.value || "");
  const [person, setPerson] = useState(startPerson ? initial : "");
  const isPerson = to === PERSON;
  const manyOrgs = orgs.length > 1;
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
      {!isPerson && (
        <div>
          <label className="label" htmlFor="compose-title">
            Subject <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="compose-title" name="title" maxLength={120} className="input" placeholder="e.g. Service project Saturday" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="compose-body">
          Message
        </label>
        <ChatBox id="compose-body" name="body" rows={5} maxLength={2000} required={isPerson} className="input" draftKey="compose" placeholder="Write your message… (Ctrl+Enter to send)" />
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
      <p className="text-xs text-muted">
        {isPerson
          ? "They get just your words, signed with your name, as a notification (or by text or email, as they chose). It opens your conversation with them."
          : "Sent as a notification, or by text or email as each person chose. The number shows how many people get it. They can reply, and replies come to your inbox."}
      </p>
      <SubmitButton pendingText="Sending…" {...(isPerson ? {} : { confirm: "Send this to everyone you chose?" })}>
        Send
      </SubmitButton>
    </form>
  );
}
