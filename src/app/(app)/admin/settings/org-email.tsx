import { Badge } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { DAILY_LIMIT, mailRoute, orgMail, sentToday } from "@/lib/mail";
import { orgFullName, wardOrg } from "@/lib/orgs";
import { removeOrgMail, saveOrgMail, testOrgMail } from "./mail-actions";

/**
 * The email account an organization's email goes out from: its own (connected here),
 * else the ward's, else (for wards that use it) the app's own. Replies go to that inbox.
 */
export function OrgEmail({
  orgId,
  wardId,
  isWard,
  back,
}: {
  orgId: number;
  wardId: number;
  isWard: boolean;
  back: "settings" | "ward";
}) {
  const own = orgMail(orgId);
  const route = mailRoute(orgId);
  const via = route[0];
  const wardAccount = isWard ? undefined : orgMail(wardOrg(wardId).id);
  const name = orgFullName(orgId);
  const hidden = (
    <>
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  const recentError =
    own?.last_error &&
    own.last_error_at &&
    Date.now() - Date.parse(own.last_error_at.replace(" ", "T") + "Z") <
      3 * 24 * 3600 * 1000;
  return (
    <div id="email" className="card max-w-xl scroll-mt-20 space-y-3 text-sm">
      <p>
        {isWard
          ? "The ward's email account sends the ward's email, and email for every organization that hasn't connected its own. Replies go to its inbox."
          : `Email from ${name} (reminders, messages, invitations) can go out from your own email account, so it comes from you and replies go to your inbox.`}
      </p>
      {own ? (
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{own.address}</strong>
            <Badge tone="success">Connected</Badge>
          </div>
          <div className="text-muted">
            Sender name: {own.from_name || name} · Sent today: {sentToday(own)}{" "}
            of about {DAILY_LIMIT}
          </div>
          {recentError && (
            <p className="mt-1 text-danger">Last problem: {own.last_error}</p>
          )}
        </div>
      ) : via === undefined ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">
          <strong>No email is connected.</strong>{" "}
          {isWard ? "Members" : `Members of ${name}`} get app notifications and
          texts, but no email, and can&apos;t sign in with an email code.
          Connect an account below.
        </p>
      ) : via === "site" ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2">
          Email now goes out from the app&apos;s own email. Connect an account
          so it comes from {isWard ? "the ward" : "you"}.
        </p>
      ) : (
        <p className="rounded-lg bg-surface-2 px-3 py-2">
          Email now goes out from the ward&apos;s account,{" "}
          <strong>{wardAccount?.address ?? via.address}</strong>. Connect your
          own so it comes from {name}.
        </p>
      )}
      {own && (
        <div className="flex flex-wrap gap-2">
          <form action={testOrgMail}>
            {hidden}
            <SubmitButton
              className="btn-secondary btn-sm"
              pendingText="Sending…"
            >
              Send me a test
            </SubmitButton>
          </form>
          <form action={removeOrgMail}>
            {hidden}
            <SubmitButton
              className="btn-secondary btn-sm"
              confirm={`Disconnect ${own.address}? ${isWard ? "Organizations without their own" : "Email"} then go out from ${isWard ? "nowhere until another is connected" : "the ward's account, if it has one"}.`}
              pendingText="…"
            >
              Disconnect
            </SubmitButton>
          </form>
        </div>
      )}
      <details open={!own && via !== "site" && !wardAccount}>
        <summary className="cursor-pointer font-semibold text-accent">
          {own
            ? "Change the account or sender name"
            : "Connect an email account"}
        </summary>
        <form action={saveOrgMail} className="mt-3 space-y-3">
          {hidden}
          <label className="block">
            <span className="label">Email address</span>
            <input
              name="address"
              type="email"
              required
              defaultValue={own?.address ?? ""}
              autoComplete="off"
              className="input"
              placeholder="villaseq@gmail.com"
            />
          </label>
          <label className="block">
            <span className="label">App password</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              className="input"
              placeholder={
                own
                  ? "Leave blank to keep the saved one"
                  : "16 letters from Google"
              }
            />
          </label>
          <label className="block">
            <span className="label">
              Sender name{" "}
              <span className="font-normal text-muted">(optional)</span>
            </span>
            <input
              name="from_name"
              maxLength={80}
              defaultValue={own?.from_name ?? ""}
              className="input"
              placeholder={name}
            />
          </label>
          <details className="text-muted">
            <summary className="cursor-pointer">Not Gmail?</summary>
            <p className="mt-1">
              Enter your provider&apos;s outgoing (SMTP) server. Most use port
              465 or 587.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                name="host"
                defaultValue={own?.host ?? "smtp.gmail.com"}
                className="input"
                aria-label="Server"
              />
              <select
                name="port"
                defaultValue={String(own?.port ?? 465)}
                className="input w-28"
                aria-label="Port"
              >
                <option value="465">465</option>
                <option value="587">587</option>
              </select>
            </div>
          </details>
          <SubmitButton pendingText="Checking…">
            {own ? "Save" : "Connect"}
          </SubmitButton>
          <div className="hint space-y-1">
            <p>
              <strong>Setting up Gmail:</strong> make a Gmail account for{" "}
              {isWard ? "the ward" : "the organization"} (for example
              villas.eq@gmail.com) so it can be handed to the next leaders. In
              that account, turn on <strong>2-Step Verification</strong> (Google
              Account → Security), then open{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                myaccount.google.com/apppasswords
              </a>
              , name it &quot;My Ward Link&quot;, and copy the 16-letter
              password here.
            </p>
            <p>
              The app checks it signs in before saving, keeps the password
              sealed, and never shows it again. A Gmail account sends up to
              about 500 emails a day.
            </p>
          </div>
        </form>
      </details>
    </div>
  );
}
