import { requireUser } from "@/lib/auth";
import { formatContact, formatPhone } from "@/lib/contact";
import { pendingVerification } from "@/lib/contact-verify";
import { phoneEnabled } from "@/lib/sms";
import { Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { addContact, confirmContact, removeContact, setContactPref } from "./actions";

export const metadata = { title: "My contact info" };

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const verifying = sp.verify ? pendingVerification(user.id, Number(sp.verify)) : undefined;
  const textingOn = phoneEnabled();
  const prefOptions: [string, string][] = [
    ...(user.phone ? ([["text", "Text"]] as [string, string][]) : []),
    ...(user.email ? ([["email", "Email"]] as [string, string][]) : []),
    ...(user.phone && user.email ? ([["both", "Both"]] as [string, string][]) : []),
    ["none", "Don't contact me"],
  ];

  const row = (kind: "phone" | "email", label: string, value: string | null) => (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <div className="text-sm text-muted">{label}</div>
        {value ? <div className="font-medium">{kind === "phone" ? formatPhone(value) : value} <span className="text-sm text-success">✓ confirmed</span></div> : <div className="text-muted">Not added</div>}
      </div>
      {value ? (
        <form action={removeContact}>
          <input type="hidden" name="kind" value={kind} />
          <SubmitButton className="btn-secondary btn-sm" confirm={`Remove this ${kind === "phone" ? "number" : "email"}?`}>
            Remove
          </SubmitButton>
        </form>
      ) : kind === "phone" && !textingOn ? (
        <span className="text-xs text-muted">Coming soon</span>
      ) : (
        <form action={addContact} className="flex flex-wrap gap-2">
          <input type="hidden" name="kind" value={kind} />
          <input
            name="value"
            required
            type={kind === "phone" ? "tel" : "email"}
            autoComplete={kind === "phone" ? "tel" : "email"}
            className="input w-56"
            placeholder={kind === "phone" ? "(208) 555-0142" : "you@example.com"}
          />
          <SubmitButton className="btn-primary btn-sm" pendingText="Sending…">
            Send code
          </SubmitButton>
        </form>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title="My contact info" back={{ href: "/more", label: "More" }} subtitle="You can sign in with either one. Only you and the quorum leaders who run the app can see them." />
      <Flash msg={sp.msg} tone={sp.ok ? "success" : "warn"} />

      {verifying && (
        <form action={confirmContact} className="card mb-5 space-y-3">
          <h2 className="h2">Enter the code</h2>
          <p className="text-sm text-muted">
            We {verifying.kind === "phone" ? "texted" : "emailed"} a 6-digit code to <strong className="text-text">{formatContact(verifying.kind, verifying.value)}</strong>.
          </p>
          <input type="hidden" name="verify_id" value={sp.verify} />
          <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="input max-w-40 text-center text-xl tracking-[0.3em]" />
          <SubmitButton pendingText="Checking…">Confirm</SubmitButton>
        </form>
      )}

      <Section title="Phone and email">
        <div className="card divide-y divide-border py-1">
          {row("phone", "Mobile number", user.phone)}
          {row("email", "Email", user.email)}
        </div>
      </Section>

      <Section title="When notifications are off">
        <form action={setContactPref} className="card space-y-3">
          <p className="text-sm text-muted">If push notifications aren&apos;t turned on for your phone, how should we send reminders and quorum messages?</p>
          <div className="flex flex-wrap gap-2">
            {prefOptions.map(([v, label]) => (
              <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${user.contact_pref === v ? "border-accent bg-accent-soft" : "border-border"}`}>
                <input type="radio" name="pref" value={v} defaultChecked={user.contact_pref === v} />
                {label}
              </label>
            ))}
          </div>
          <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
          {user.phone && <p className="hint">Texts come from the quorum&apos;s number. Reply STOP anytime to stop them.</p>}
        </form>
      </Section>
    </>
  );
}
