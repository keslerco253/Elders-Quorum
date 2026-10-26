import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { CALENDAR_ALERT_OPTIONS, feedUrls, parseAlerts } from "@/lib/events";
import { isAdmin } from "@/lib/permissions";
import { Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { CopyButton } from "@/components/copy-button";
import { resetFeedLink, saveCalendarAlerts, saveFeedContents } from "./actions";
import { FEED_CONTENTS } from "@/lib/types";

export const metadata = { title: "Subscribe to the calendar" };

export default async function SubscribePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const urls = feedUrls(user);
  const ua = (await headers()).get("user-agent") ?? "";
  const android = /Android/i.test(ua);
  const [alert1, alert2] = parseAlerts(user.calendar_alerts);
  const alertSelect = (name: string, value: number | undefined, label: string) => (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} className="input" defaultValue={value ?? ""}>
        <option value="">None</option>
        {CALENDAR_ALERT_OPTIONS.map(([m, text]) => (
          <option key={m} value={m}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );

  const apple = (
    <div className="card space-y-2">
      <div className="font-semibold">iPhone, iPad or Mac (Apple Calendar)</div>
      <a href={urls.webcal} className="btn-primary">
        Subscribe in Apple Calendar
      </a>
      <p className="text-sm text-muted">
        Tap it, then tap <strong>Subscribe</strong>. To get the reminders above, turn <strong>off &quot;Remove Alerts&quot;</strong> (on a Mac, uncheck <strong>Alerts</strong> next to Remove), then tap <strong>Add</strong> or <strong>Done</strong>. A &quot;{user.ward.name}&quot; calendar appears in your Calendar app.
      </p>
    </div>
  );
  const google = (
    <div className="card space-y-2">
      <div className="font-semibold">Google Calendar (Android or computer)</div>
      <a href={urls.google} target="_blank" rel="noreferrer" className={android ? "btn-primary" : "btn-secondary"}>
        Subscribe in Google Calendar
      </a>
      <p className="text-sm text-muted">
        Opens Google Calendar on the web: tap <strong>Add</strong>. It then shows on your phone too. Google only checks for changes a few times a day and doesn&apos;t use the reminders above; set reminders in Google Calendar instead.
      </p>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Subscribe to the calendar"
        back={{ href: "/calendar", label: "Calendar" }}
        subtitle={`Ward events and those of your organizations, your own events, or both show up in your own calendar app and stay up to date: new events appear and changes or cancellations update by themselves. Change what's included here anytime.${isAdmin(user) ? " Yours includes presidency-only events." : ""}`}
      />
      <Flash msg={sp.msg} tone={sp.ok ? "success" : "warn"} />
      <form id="contents" action={saveFeedContents} className="card mb-3 scroll-mt-20 space-y-3">
        <div className="font-semibold">What&apos;s in your calendar</div>
        <div className="space-y-2">
          {FEED_CONTENTS.map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-2 text-sm">
              <input type="radio" name="contents" value={value} defaultChecked={(user.feed_contents ?? "both") === value} className="mt-1" />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        <SubmitButton className="btn-primary btn-sm" pendingText="Saving…">
          Save
        </SubmitButton>
      </form>
      <form id="reminders" action={saveCalendarAlerts} className="card mb-3 scroll-mt-20 space-y-3">
        <div>
          <div className="font-semibold">Reminders on your calendar events</div>
          <p className="text-sm text-muted">Added to every event in your subscribed calendar and to events you add one at a time.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {alertSelect("alert1", alert1, "Reminder")}
          {alertSelect("alert2", alert2, "Second reminder")}
        </div>
        <SubmitButton className="btn-primary btn-sm" pendingText="Saving…">
          Save reminders
        </SubmitButton>
      </form>
      <div className="space-y-3">
        {android ? (
          <>
            {google}
            {apple}
          </>
        ) : (
          <>
            {apple}
            {google}
          </>
        )}
        <div className="card space-y-2">
          <div className="font-semibold">Outlook or another calendar</div>
          <p className="text-sm text-muted">
            Copy your link, then in Outlook choose <strong>Add calendar → Subscribe from web</strong> and paste it.
          </p>
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs break-all">{urls.https}</p>
          <CopyButton text={urls.https} label="Copy link" />
        </div>
      </div>

      <Section title="Good to know">
        <ul className="card list-disc space-y-1 pl-8 text-sm text-muted">
          <li>Calendar apps check for changes on their own schedule (Apple usually every hour or so, Google a few times a day), so a brand-new event may take a while to appear.</li>
          <li>To stop, delete the &quot;{user.ward.name}&quot; calendar in your calendar app.</li>
          <li>Changing what&apos;s in your calendar above keeps the same link: your calendar app shows the change the next time it checks.</li>
          <li>This link is just for you (it can have your own events too). If you shared it by mistake, reset it below.</li>
        </ul>
        <form action={resetFeedLink} className="mt-3">
          <SubmitButton className="btn-secondary btn-sm" confirm="Make a new link? Calendars using the old one stop updating." pendingText="Resetting…">
            Reset my link
          </SubmitButton>
        </form>
      </Section>
    </>
  );
}
