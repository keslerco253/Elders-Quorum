import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { hasJournalPasscode, MIN_PASSCODE } from "@/lib/journal";
import { Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { changePasscodeAction, removePasscodeAction, setPasscodeAction } from "../actions";

export const metadata = { title: "Journal passcode" };

function Pass({ name, label, autoComplete = "new-password" }: { name: string; label: string; autoComplete?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type="password" className="input" required minLength={name === "current" ? undefined : MIN_PASSCODE} maxLength={100} autoComplete={autoComplete} />
    </div>
  );
}

export default async function JournalPasscodePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const on = hasJournalPasscode(user.id);
  return (
    <>
      <PageHeader
        title="Journal passcode"
        back={{ href: "/journal", label: "My Journal" }}
        subtitle={on ? "Your journal has a passcode." : "Optional: lock your journal with a passcode only you know."}
      />
      <Flash msg={sp.msg} tone="danger" />
      {on ? (
        <>
          <Section title="Change your passcode">
            <form action={changePasscodeAction} className="card space-y-3">
              <Pass name="current" label="Current passcode" autoComplete="current-password" />
              <Pass name="new_passcode" label="New passcode" />
              <Pass name="confirm" label="New passcode again" />
              <SubmitButton>Change passcode</SubmitButton>
            </form>
          </Section>
          <Section title="Turn the passcode off">
            <form action={removePasscodeAction} className="card space-y-3">
              <p className="text-sm text-muted">Your journal opens without a passcode again. It&apos;s still private to you and stored encrypted.</p>
              <Pass name="current" label="Your passcode" autoComplete="current-password" />
              <SubmitButton className="btn-secondary">Turn off passcode</SubmitButton>
            </form>
          </Section>
        </>
      ) : (
        <form action={setPasscodeAction} className="card space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Your journal asks for the passcode when you open it, and locks again after 30 minutes without using it.</li>
            <li>What you write is locked with your passcode. The passcode isn&apos;t kept anywhere, so no one else can open your journal, not even the site owner.</li>
            <li>
              <strong>If you forget it, your journal can&apos;t be recovered.</strong> No one can reset it; the only way back is to erase the journal and start over.{" "}
              <Link href="/journal/export" className="link">
                Download a copy
              </Link>{" "}
              first if you&apos;d like one.
            </li>
          </ul>
          <Pass name="passcode" label={`Passcode (at least ${MIN_PASSCODE} characters)`} />
          <Pass name="confirm" label="Passcode again" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="understand" required className="mt-1" />
            <span>I understand that if I forget my passcode, my journal can&apos;t be recovered.</span>
          </label>
          <SubmitButton>🔒 Set passcode</SubmitButton>
        </form>
      )}
    </>
  );
}
