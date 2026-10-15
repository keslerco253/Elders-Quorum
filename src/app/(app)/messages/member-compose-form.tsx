import type { MemberOrgChoices } from "@/lib/compose";
import { ChatBox } from "@/components/chat-box";
import { SubmitButton } from "@/components/client";
import { memberCompose } from "./actions";

/** New message, for members: to their leaders (all of them or one privately), or a group they can send to. */
export function MemberComposeForm({ orgs, initial }: { orgs: MemberOrgChoices[]; initial: string }) {
  const manyOrgs = orgs.length > 1;
  return (
    <form action={memberCompose} className="card max-w-2xl space-y-4">
      <div>
        <label className="label" htmlFor="compose-to">
          To
        </label>
        <select id="compose-to" name="to" className="input" defaultValue={initial || orgs[0]?.choices[0]?.value} required>
          {orgs.map((o) => (
            <optgroup key={o.orgId} label={o.label}>
              {o.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                  {manyOrgs ? ` · ${o.label}` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="hint">Choose one person to keep it private: the rest of the leaders won&apos;t see it.</p>
      </div>
      <div>
        <label className="label" htmlFor="compose-body">
          Message
        </label>
        <ChatBox id="compose-body" name="body" rows={5} maxLength={1000} required className="input" draftKey="member-compose" placeholder="Write your message… (Ctrl+Enter to send)" />
      </div>
      <SubmitButton pendingText="Sending…">Send</SubmitButton>
    </form>
  );
}
