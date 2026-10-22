import { requireUser } from "@/lib/auth";
import { formatContact, formatPhone } from "@/lib/contact";
import { pendingVerification } from "@/lib/contact-verify";
import { phoneEnabled, phoneOptInVisible, SMS_DISCLOSURE, memberTextable } from "@/lib/sms";
import { Flash, PageHeader, Section } from "@/components/ui";
import { CodeInput } from "@/components/code-input";
import { SubmitButton } from "@/components/client";
import { addContact, confirmContact, removeContact, setDelivery } from "./actions";
import { PushToggle } from "@/components/push-toggle";

export const metadata = { title: "Contact & notifications" };

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const verifying = sp.verify ? pendingVerification(user.id, Number(sp.verify)) : undefined;
  const textingOn = phoneEnabled() && memberTextable(user.id);
  // While carriers review the texting registration, members can already opt in.
  const canChooseText = phoneOptInVisible() && memberTextable(user.id);
  const prefOptions: [string, string][] = [
    ...(user.phone && canChooseText ? ([["text", "Text"]] as [string, string][]) : []),
    ...(user.email ? ([["email", "Email"]] as [string, string][]) : []),
    ...(user.phone && user.email && canChooseText ? ([["both", "Both"]] as [string, string][]) : []),
    ["none", "Nothing"],
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
        <span className="text-xs text-muted">{phoneEnabled() ? "Your ward uses email" : "Coming soon"}</span>
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
          {kind === "phone" && (
            <>
              <label className="flex w-full items-start gap-2 text-sm">
                <input type="checkbox" name="texts" defaultChecked className="mt-1" />
                <span>
                  <strong>Send me reminders and messages by text</strong>
                  <span className="block text-muted">Untick to use this number only for sign-in codes. You can change it below anytime.</span>
                </span>
              </label>
              <p className="hint w-full">Ticked, you agree to receive texts from your ward. {SMS_DISCLOSURE}</p>
            </>
          )}
        </form>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title="Contact & notifications" back={{ href: "/more", label: "More" }} subtitle="You can sign in with either one. Only you and your ward&apos;s leaders can see them." />
      <Flash msg={sp.msg} tone={sp.ok ? "success" : "warn"} />

      {verifying && (
        <form action={confirmContact} className="card mb-5 space-y-3">
          <h2 className="h2">Enter the code</h2>
          <p className="text-sm text-muted">
            We {verifying.kind === "phone" ? "texted" : "emailed"} a 6-digit code to <strong className="text-text">{formatContact(verifying.kind, verifying.value)}</strong>.
          </p>
          <input type="hidden" name="verify_id" value={sp.verify} />
          {verifying.kind === "phone" && <input type="hidden" name="texts" value={sp.texts === "0" ? "0" : "1"} />}
          <CodeInput className="input max-w-40 text-center text-xl tracking-[0.3em]" />
          <SubmitButton pendingText="Checking…">Confirm</SubmitButton>
        </form>
      )}

      <Section title="Phone and email">
        <div className="card divide-y divide-border py-1">
          {row("phone", "Mobile number", user.phone)}
          {row("email", "Email", user.email)}
        </div>
      </Section>

      <Section title="How we reach you">
        <div className="card mb-3 space-y-2">
          <div className="font-medium">Push notifications</div>
          <p className="text-sm text-muted">Free and instant. Turn them on for each phone or computer you use.</p>
          <PushToggle />
        </div>
        <form action={setDelivery} className="card space-y-4">
          <div className="space-y-2">
            <div className="font-medium">Also send every reminder and message by</div>
            <label className={`flex items-center gap-2 text-sm ${user.email ? "" : "opacity-50"}`}>
              <input type="checkbox" name="always_email" defaultChecked={!!user.always_email} disabled={!user.email} />
              Email{user.email ? ` to ${user.email}` : ": add an email above first"}
            </label>
            {canChooseText && (
              <label className={`flex items-center gap-2 text-sm ${user.phone ? "" : "opacity-50"}`}>
                <input type="checkbox" name="always_text" defaultChecked={!!user.always_text && !!user.sms_consent_at} disabled={!user.phone} />
                Text{user.phone ? ` to ${formatPhone(user.phone)}` : ": add a mobile number above first"}
              </label>
            )}
            <p className="hint">
              Leave these off to get just the push notification. Reminders for lessons, events and service can each be set their own way under{" "}
              <a href="/more/reminders" className="link">
                My reminders
              </a>
              .
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-medium">If a notification doesn&apos;t reach you</div>
            <p className="text-sm text-muted">For example, if notifications are turned off on your phone. Not used when one of the boxes above is checked.</p>
            <div className="flex flex-wrap gap-2">
              {prefOptions.map(([v, label]) => (
                <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${user.contact_pref === v ? "border-accent bg-accent-soft" : "border-border"}`}>
                  <input type="radio" name="pref" value={v} defaultChecked={user.contact_pref === v} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
          {user.phone && canChooseText && !textingOn && (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">Texting starts once the phone carriers approve the app&apos;s number. You can choose it now; until then you&apos;ll get email instead.</p>
          )}
          {user.phone && canChooseText && (
            <p className="hint">
              Choosing to get texts means you agree to receive reminders and messages from your ward and its organizations by text. {SMS_DISCLOSURE}
            </p>
          )}
        </form>
      </Section>
    </>
  );
}
