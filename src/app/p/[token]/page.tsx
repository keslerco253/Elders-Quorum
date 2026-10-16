import { getShare } from "@/lib/public-shares";
import { getOrg, getWard, orgLabel } from "@/lib/orgs";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { isPicture } from "@/lib/upload-names";
import { GUEST_TEXT_CONSENT, slotTaken } from "@/lib/guest-signups";
import { phoneEnabled, phoneOptInVisible } from "@/lib/sms";
import { stillNeeded, type Signup } from "@/lib/signups";
import { FlyerView } from "@/components/flyer-view";
import { CodeInput } from "@/components/code-input";
import { SubmitButton } from "@/components/client";
import { Flash } from "@/components/ui";
import { guestConfirm, guestSignUp } from "./actions";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const s = getShare((await params).token);
  return { title: s?.title || "My Ward Link", robots: { index: false } };
}

/**
 * What a public link or QR code opens: the one picture or PDF shared, or one service
 * opportunity anyone can sign up for. Nothing else in the app can be reached from here.
 */
export default async function PublicSharePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const share = getShare(token);
  if (!share)
    return (
      <div className="card mx-auto max-w-md text-center">
        <h1 className="h2">This link isn&apos;t active</h1>
        <p className="mt-1 text-sm text-muted">Whoever shared it has stopped sharing it.</p>
      </div>
    );
  const org = getOrg(share.org_id)!;
  const ward = getWard(org.ward_id);
  const from = org.kind === "ward" ? (ward?.name ?? "") : `${ward?.name ?? ""} ${orgLabel(org)}`;
  const fileSrc = `/p/${token}/file`;
  // Signed in to the app (and in that ward): offer the full page there too.
  const user = await getUser();
  const member = user && user.wards.some((w) => w.id === org.ward_id);

  if (share.kind === "file") {
    return (
      <div className="space-y-4">
        <header className="text-center">
          <div className="text-sm text-muted">{from}</div>
          {share.title && <h1 className="h1 mt-1">{share.title}</h1>}
          {share.caption && <p className="mt-2 whitespace-pre-wrap">{share.caption}</p>}
        </header>
        <FlyerView file={share.file!} name={share.title || "Flyer"} src={fileSrc} className="card" />
        <p className="text-center text-sm">
          <a href={fileSrc} download className="link">
            {isPicture(share.file!) ? "Save the picture" : "Download the PDF"}
          </a>
        </p>
      </div>
    );
  }

  const s = db().prepare("SELECT * FROM signups WHERE id = ?").get(share.signup_id) as Signup | undefined;
  if (!s) return <p className="card text-center">This sign-up is no longer available.</p>;
  const slots = db().prepare("SELECT id, label, capacity FROM signup_slots WHERE signup_id = ? ORDER BY position, id").all(s.id) as { id: number; label: string; capacity: number }[];
  const open = slots.map((sl) => ({ ...sl, left: Math.max(0, sl.capacity - slotTaken(sl.id)) }));
  const today = new Date().toISOString().slice(0, 10);
  const closed = !!s.closed || (!!s.date && s.date < today);
  const anyOpen = open.some((sl) => sl.left > 0);
  const phone = phoneEnabled();
  return (
    <div className="space-y-4">
      <header className="text-center">
        <div className="text-sm text-muted">{from}</div>
        <h1 className="h1 mt-1">{share.title || s.title}</h1>
        {s.date && <div className="mt-1 font-medium">{formatDate(s.date)}</div>}
        {share.caption && <p className="mt-2 whitespace-pre-wrap">{share.caption}</p>}
      </header>
      {s.description && <p className="card whitespace-pre-wrap">{s.description}</p>}
      {s.flyer_file && <FlyerView file={s.flyer_file} name={s.flyer_name} src={fileSrc} className="card" />}

      <section id="signup" className="card scroll-mt-4 space-y-4">
        <h2 className="h2">Sign up</h2>
        <Flash msg={sp.error} tone="warn" />
        {sp.done ? (
          <p className="rounded-lg bg-success/10 px-3 py-3 text-success">
            ✓ You&apos;re signed up. Thank you! We sent you a confirmation with a link in case you can&apos;t make it.
          </p>
        ) : sp.confirm ? (
          <form action={guestConfirm} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="guest_id" value={sp.confirm} />
            <input type="hidden" name="via" value={sp.via ?? ""} />
            <p className="text-sm">We sent a 6-digit code to your {sp.via === "phone" ? "phone" : "email"}. Enter it to confirm your spot.</p>
            <CodeInput className="input max-w-48 text-center text-lg tracking-widest" />
            <SubmitButton pendingText="Confirming…">Confirm</SubmitButton>
          </form>
        ) : closed || !anyOpen ? (
          <p className="text-sm text-muted">{closed ? "Sign-ups for this are closed." : "Every spot is filled. Thank you to everyone who signed up!"}</p>
        ) : (
          <form action={guestSignUp} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <fieldset className="space-y-2">
              <legend className="label">Choose a spot</legend>
              {open.map((sl) => (
                <label key={sl.id} className={`flex items-center gap-3 rounded-lg border border-border px-3 py-2 ${sl.left ? "" : "opacity-50"}`}>
                  <input type="radio" name="slot_id" value={sl.id} required disabled={!sl.left} defaultChecked={open.filter((o) => o.left).length === 1 && !!sl.left} />
                  <span className="flex-1 font-medium">{sl.label}</span>
                  <span className="text-sm text-muted">{sl.left ? stillNeeded(sl.left) : "Full"}</span>
                </label>
              ))}
            </fieldset>
            <div>
              <label className="label" htmlFor="g-name">
                Your name
              </label>
              <input id="g-name" name="name" required maxLength={100} autoComplete="name" className="input" defaultValue={sp.name} />
            </div>
            <div>
              <label className="label" htmlFor="g-contact">
                {phone ? "Mobile number or email" : "Email"}
              </label>
              <input id="g-contact" name="contact" required autoComplete={phone ? "tel" : "email"} className="input" defaultValue={sp.contact} />
              <p className="hint">For your confirmation code and reminders. Only the organizers see it.</p>
            </div>
            <div>
              <label className="label" htmlFor="g-note">
                Note <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id="g-note" name="note" maxLength={200} className="input" placeholder="e.g. I'll bring a ladder" defaultValue={sp.note} />
            </div>
            {phoneOptInVisible() && (
              <label className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-sm">
                <input type="checkbox" name="text_consent" className="mt-1" />
                <span>
                  {GUEST_TEXT_CONSENT}{" "}
                  <a href="/privacy" className="link" target="_blank">
                    Privacy
                  </a>{" "}
                  ·{" "}
                  <a href="/terms" className="link" target="_blank">
                    Terms
                  </a>
                  <span className="mt-1 block text-xs text-muted">Only needed if you give a mobile number. Leave it unticked to use email instead.</span>
                </span>
              </label>
            )}
            <SubmitButton pendingText="Sending your code…">Sign me up</SubmitButton>
            <p className="text-xs text-muted">No account needed. Your name and contact are only used for this, and are deleted 30 days after it.</p>
          </form>
        )}
      </section>
      {member && (
        <p className="text-center text-sm">
          <a href={`/signups/${s.id}?org=${s.org_id}`} className="link">
            Open in My Ward Link
          </a>
        </p>
      )}
    </div>
  );
}
