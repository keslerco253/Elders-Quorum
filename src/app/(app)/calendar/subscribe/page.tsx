import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { feedUrls } from "@/lib/events";
import { isAdmin } from "@/lib/permissions";
import { Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { CopyButton } from "@/components/copy-button";
import { resetFeedLink } from "./actions";

export const metadata = { title: "Subscribe to the calendar" };

export default async function SubscribePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const urls = feedUrls(user);
  const ua = (await headers()).get("user-agent") ?? "";
  const android = /Android/i.test(ua);

  const apple = (
    <div className="card space-y-2">
      <div className="font-semibold">iPhone, iPad or Mac (Apple Calendar)</div>
      <a href={urls.webcal} className="btn-primary">
        Subscribe in Apple Calendar
      </a>
      <p className="text-sm text-muted">Tap it, then tap <strong>Subscribe</strong>, then <strong>Done</strong> (or <strong>Add</strong>). A &quot;{user.ward.name}&quot; calendar appears in your Calendar app.</p>
    </div>
  );
  const google = (
    <div className="card space-y-2">
      <div className="font-semibold">Google Calendar (Android or computer)</div>
      <a href={urls.google} target="_blank" rel="noreferrer" className={android ? "btn-primary" : "btn-secondary"}>
        Subscribe in Google Calendar
      </a>
      <p className="text-sm text-muted">Opens Google Calendar on the web: tap <strong>Add</strong>. It then shows on your phone too. Google only checks for changes a few times a day.</p>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Subscribe to the calendar"
        back={{ href: "/calendar", label: "Calendar" }}
        subtitle={`Every quorum event shows up in your own calendar app and stays up to date: new events appear and changes or cancellations update by themselves.${isAdmin(user) ? " Yours includes presidency-only events." : ""}`}
      />
      <Flash msg={sp.msg} tone="warn" />
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
          <li>This link is just for you. If you shared it by mistake, reset it below.</li>
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
