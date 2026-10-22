import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { leaderUnread, unreadAnswers } from "@/lib/conversations";
import { unreadAnnouncements } from "@/lib/member-inbox";
import { unreadNotifications } from "@/lib/notification-log";
import { callingLabel, leadersWord, roleLabel } from "@/lib/types";
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
  const unread = unreadAnswers(user.id) + unreadAnnouncements(user.id) + leaderUnread(user.id);
  const newNotes = unreadNotifications(user.id);
  const links: { href: string; label: string; desc: string; count?: number }[] = [
    ...(hasFeature(user.org, "signups") ? [{ href: "/signups", label: "Service", desc: "Service projects, meals, rides and more" }] : []),
    { href: "/challenges", label: "Challenges", desc: "Friendly competitions between organizations: who's ahead, and log what you did" },
    { href: "/assignments", label: "My assignments", desc: "What you've been asked to do, lessons you're teaching, service you signed up for" },
    { href: "/notifications", label: "Reminders & alerts", count: newNotes, desc: "Every reminder and alert the app sent you (messages are in Messages)" },
    { href: "/more/organizations", label: "My organizations", desc: "Which organizations you belong to and get notifications from" },
    { href: "/messages", label: "Messages", count: unread, desc: `Messages from ${user.orgLabel} and replies from its ${leadersWord(user.org)}` },
    ...(myOrgs(user.id).some((o) => hasFeature(o, "visits")) ? [{ href: "/more/visit", label: "Request a visit", desc: "Ask your leaders to come by, talk, or help" }] : []),
    { href: "/more/home", label: "Customize Home", desc: "Put your Home page sections in the order you like, or hide some" },
    { href: "/more/reminders", label: "My reminders", desc: "When and how you're reminded about lessons, events and service" },
    { href: "/more/contact", label: "Contact & notifications", desc: "Phone, email, and how you get reminders and messages" },
  ];
  return (
    <>
      <PageHeader title="More" />
      <Flash msg={sp.msg} tone="warn" />
      <Section title="Go to">
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
                <span>
                  <span className="block font-medium">{l.label}</span>
                  <span className="text-sm text-muted">{l.desc}</span>
                </span>
                <span className="flex items-center gap-2">
                  <CountDot n={l.count} />
                  <span className="text-muted">›</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
          <p className="text-muted">Permanently removes your name, email, comments, sign-ups and everything else you&apos;ve posted. You can join again later.</p>
          <input name="confirm" placeholder="Type DELETE to confirm" className="input max-w-56" autoComplete="off" />
          <SubmitButton className="btn-danger btn-sm" pendingText="Deleting…" confirm="Delete your account permanently?">
            Delete my account
          </SubmitButton>
        </form>
      </Section>
    </>
  );
}
