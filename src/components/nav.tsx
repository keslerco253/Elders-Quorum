"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string; badge?: number };

const icons: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0v16M8 7h7",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  plan: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={name === "more" ? 3.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={icons[name]} />
    </svg>
  );
}

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function Nav({ appName, isAdmin, adminCount, moreCount = 0 }: { appName: string; isAdmin: boolean; adminCount: number; moreCount?: number }) {
  const path = usePathname();
  // The page being read clears these, so don't show the dot there.
  if (path.startsWith("/messages")) moreCount = 0;
  const main: Item[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/lessons", label: "Lessons", icon: "book" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/plans", label: "Plans", icon: "plan" },
  ];
  const desktopExtra: Item[] = [
    { href: "/signups", label: "Sign-ups", icon: "list" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "shield", badge: adminCount }] : []),
    { href: "/more", label: "More", icon: "more", badge: moreCount },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold text-text">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span className="truncate">{appName}</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {[...main, ...desktopExtra].map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium ${isActive(path, i.href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text"}`}
              >
                {i.label}
                {!!i.badge && <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{i.badge}</span>}
              </Link>
            ))}
          </nav>
          {isAdmin && (
            <Link href="/admin" className="relative ml-auto rounded-lg px-2 py-1 text-sm font-medium text-accent md:hidden">
              Admin
              {adminCount > 0 && <span className="ml-1 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{adminCount}</span>}
            </Link>
          )}
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {[...main, { href: "/more", label: "More", icon: "more", badge: moreCount }].map((i) => (
            <Link key={i.href} href={i.href} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive(path, i.href) ? "text-accent" : "text-muted"}`}>
              {!!i.badge && <span className="absolute top-1 left-1/2 ml-2 h-2.5 w-2.5 rounded-full bg-danger" aria-label={`${i.badge} new`} />}
              <Icon name={i.icon} />
              {i.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
