import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { leaderUnread, unreadAnswers } from "@/lib/conversations";
import { unreadAnnouncements } from "@/lib/member-inbox";
import { unreadNotifications } from "@/lib/notification-log";
import { callingLabel, roleLabel } from "@/lib/types";
import { hasFeature, myOrgs } from "@/lib/orgs";
import { formatPhone } from "@/lib/contact";
import { CountDot, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { QuickLinks } from "@/components/quick-links";
import { PushToggle } from "@/components/push-toggle";
import { AppLockToggle } from "@/components/app-lock-toggle";
import { signOut } from "../../(public)/actions";
import { SignOutForm } from "@/components/sign-out-form";
import { deleteMyAccount, setTheme } from "./actions";

export const metadata = { title: "More" };

export default async function MorePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  // In support view (looking into another ward), nothing of the owner's own ward shows here.
  const own = !user.support;
  const unread = own ? unreadAnswers(user.id) + unreadAnnouncements(user.id) + leaderUnread(user.id) : 0;
  const newNotes = own ? unreadNotifications(user.id) : 0;
  const mine = own ? myOrgs(user.id) : user.orgs;
  // Messages holds what every one of their organizations sent them (the ward's too), not just the one they're looking at.
  const from = mine.map((o) => o.label);
  const fromText = from.length > 1 ? `${from.slice(0, -1).join(", ")} and ${from.at(-1)}` : (from[0] ?? user.orgLabel);
  const links: { href: string; label: string; desc: string; count?: number }[] = [
    ...(own && mine.some((o) => hasFeature(o, "visits")) ? [{ href: "/more/visit", label: "Request a visit", desc: "Ask your leaders to come by, talk, or help" }] : []),
    { href: "/assignments", label: "My assignments", desc: "What you've been asked to do, lessons you're teaching, service you signed up for" },
    { href: "/notifications", label: "Reminders & alerts", count: newNotes, desc: "Every reminder and alert the app sent you (messages are in Messages)" },
    ...(hasFeature(user.org, "signups") ? [{ href: "/signups", label: "Service", desc: "Service projects, meals, rides and more" }] : []),
    { href: "/messages", label: "Messages", count: unread, desc: `Messages from ${fromText}, and your conversations with their leaders` },
    { href: "/journal", label: "My Journal", desc: "Write about your day. Only you can see it; print it or download it any time" },
    ...(mine.some((o) => hasFeature(o, "challenges")) ? [{ href: "/challenges", label: "Challenges", desc: "Friendly competitions between organizations: who's ahead, and log what you did" }] : []),
    { href: "/more/organizations", label: "My organizations", desc: "Which organizations you belong to and get notifications from" },
    { href: "/more/home", label: "Customize Home", desc: "Put your Home page sections in the order you like, or hide some" },
    { href: "/more/reminders", label: "Reminder settings", desc: "When and how you're reminded about lessons, events, service and assignments" },
    { href: "/more/contact", label: "Contact & notifications", desc: "Phone, email, and how you get reminders and messages" },
    { href: "/more/help", label: "Help", desc: "How to use the app: ask a question or look it up" },
    { href: "/more/suggest", label: "Suggest an improvement", desc: "An idea to make the app better? Send it to the person who runs the app" },
  ];
  return (
    <>
      <PageHeader title="More" />
      <Flash msg={sp.msg} tone="warn" />
      <Section title="Go to">
        {/* The same cards as the Admin page. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="card flex items-start justify-between gap-3 hover:bg-surface-2">
              <span>
                <span className="block font-semibold">{l.label}</span>
                <span className="text-sm text-muted">{l.desc}</span>
              </span>
              <CountDot n={l.count} />
            </Link>
          ))}
        </div>
      </Section>
      <Section title="Church apps">
        <QuickLinks />
      </Section>
      <Section title="Notifications">
        <PushToggle />
      </Section>
      <AppLockToggle />
      <Section title="Appearance">
        <form action={setTheme} className="flex gap-2">
          {(["system", "light", "dark"] as const).map((t) => (
            <SubmitButton key={t} name="theme" value={t} className={user.theme === t ? "btn-primary flex-1" : "btn-secondary flex-1"} pendingText="…">
              {t === "system" ? "Automatic" : t === "light" ? "Light" : "Dark"}
            </SubmitButton>
          ))}
        </form>
      </Section>
      <Section title="Account">
        <div className="card space-y-1 text-sm">
          <div className="font-semibold">{user.display_name}</div>
          <div className="text-muted">{[formatPhone(user.phone), user.email].filter(Boolean).join(" · ")}</div>
          <div className="text-muted">
            In {user.orgLabel}: {user.calling ? callingLabel(user.calling, user.org) : roleLabel(user.role, user.org)}
          </div>
          <p className="hint pt-2">
            This app keeps only your name, your phone number and email (whichever you gave), and what you post.{" "}
            <Link href="/privacy" className="link">
              Privacy details
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="link">
              Terms and conditions
            </Link>
          </p>
          <SignOutForm action={signOut} className="pt-3">
            <SubmitButton className="btn-secondary" pendingText="Signing out…">
              Sign out
            </SubmitButton>
          </SignOutForm>
        </div>
      </Section>
      <Section title="Delete my account">
        <form action={deleteMyAccount} className="card space-y-3 text-sm">
          <p className="text-muted">Permanently removes your name, email, comments, sign-ups, your journal and everything else you&apos;ve posted. Print or download your journal first if you want to keep it. You can join again later.</p>
          <input name="confirm" placeholder="Type DELETE to confirm" className="input max-w-56" autoComplete="off" />
          <SubmitButton className="btn-danger btn-sm" pendingText="Deleting…" confirm="Delete your account permanently?">
            Delete my account
          </SubmitButton>
        </form>
      </Section>
    </>
  );
}
