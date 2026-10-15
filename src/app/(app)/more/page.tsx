import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { leaderUnread, unreadAnswers } from "@/lib/conversations";
import { unreadNotifications } from "@/lib/notification-log";
import { callingLabel, leadersWord, roleLabel } from "@/lib/types";
import { hasFeature, ledOrgsAnywhere, myOrgs } from "@/lib/orgs";
import { formatPhone } from "@/lib/contact";
import { CountDot, Flash, PageHeader, Section } from "@/components/ui";
import { adminCounts } from "@/lib/admin-counts";
import { SubmitButton } from "@/components/client";
import { QuickLinks } from "@/components/quick-links";
import { PushToggle } from "@/components/push-toggle";
import { signOut } from "../../(public)/actions";
import { deleteMyAccount, setTheme } from "./actions";

export const metadata = { title: "More" };

export default async function MorePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unread = unreadAnswers(user.id) + leaderUnread(user.id);
  const newNotes = unreadNotifications(user.id);
  const links: { href: string; label: string; desc: string; count?: number }[] = [
    { href: "/notifications", label: "Notifications", count: newNotes, desc: "Read the full text of everything the app sent you" },
    { href: "/more/organizations", label: "My organizations", desc: "Which organizations you belong to and get notifications from" },
    { href: "/messages", label: "Messages", count: unread, desc: `Messages from ${user.orgLabel} and replies from its ${leadersWord(user.org)}` },
    ...(hasFeature(user.org, "signups") ? [{ href: "/signups", label: "Service", desc: "Service projects, meals, rides and more" }] : []),
    ...(myOrgs(user.id).some((o) => hasFeature(o, "visits")) ? [{ href: "/more/visit", label: "Request a visit", desc: "Ask your leaders to come by, talk, or help" }] : []),
    { href: "/more/contact", label: "Contact & notifications", desc: "Phone, email, and how you get reminders and messages" },
    ...(isAdmin(user) || ledOrgsAnywhere(user.id).length ? [{ href: "/admin", label: "Admin tools", count: adminCounts(user).total, desc: "Members, lessons, messages and approvals" }] : []),
    ...(user.is_site_owner ? [{ href: "/site", label: "Site owner", desc: "Every ward, texting, backups" }] : []),
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
            This app keeps only your name, email and what you post.{" "}
            <Link href="/privacy" className="link">
              Privacy details
            </Link>
          </p>
          <form action={signOut} className="pt-3">
            <SubmitButton className="btn-secondary" pendingText="Signing out…">
              Sign out
            </SubmitButton>
          </form>
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
