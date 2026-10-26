"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { appHasTabs, postToApp, sendWidgetKey } from "@/lib/native-app";

type Item = { href: string; label: string; icon: string; badge?: number };

const icons: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0v16M8 7h7",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  plan: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  // Service: two people (the name stays "list", which the phone app looks up).
  list: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  chat: "M4 5h16v11H8l-4 4z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={name === "more" ? 3.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={icons[name]} />
    </svg>
  );
}

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/**
 * Keeps the bottom tab bar on the bottom of the screen. In iPhone Home Screen
 * apps, after the keyboard opens and closes the page's own height can stay
 * shrunk, so a "fixed to the bottom" bar ends up halfway up and scrolls with the
 * page. The visible area (visualViewport) is still right, so the bar is moved
 * to match it. While typing, the bar is hidden instead of floating over the keyboard.
 */
function useStickToBottom(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const keyboardOpen = isTyping() && vv.height < window.innerHeight - 120;
        el.style.opacity = keyboardOpen ? "0" : "";
        el.style.pointerEvents = keyboardOpen ? "none" : "";
        // Distance between the bottom of the page's box and the bottom of what's visible.
        // The bug leaves the page's box too short (gap below zero), so the bar is only ever
        // moved down. Anything else (the keyboard still closing, Safari's floating toolbar)
        // keeps it on the bottom instead of lifting it into the middle of the screen.
        const gap = window.innerHeight - (vv.offsetTop + vv.height);
        el.style.transform = !keyboardOpen && gap < -1 ? `translateY(${-gap}px)` : "";
      });
    };
    // After the keyboard closes, nudge iPhone into recalculating the page size.
    const afterTyping = () => setTimeout(() => {
      window.scrollTo(window.scrollX, window.scrollY);
      place();
    }, 300);
    vv.addEventListener("resize", place);
    vv.addEventListener("scroll", place);
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    window.addEventListener("orientationchange", place);
    document.addEventListener("focusin", place);
    document.addEventListener("focusout", afterTyping);
    document.addEventListener("visibilitychange", place);
    place();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", place);
      vv.removeEventListener("scroll", place);
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      window.removeEventListener("orientationchange", place);
      document.removeEventListener("focusin", place);
      document.removeEventListener("focusout", afterTyping);
      document.removeEventListener("visibilitychange", place);
    };
  }, [ref]);
}

function isActive(path: string, href: string) {
  // A conversation with a member is part of Messages, not Admin.
  if (path.startsWith("/admin/replies")) return href === "/messages";
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export interface SwitchTarget {
  id: number;
  label: string;
  ward: string;
}

/**
 * The organization being looked at, and a menu to switch to another (or to
 * another ward). Each link goes home with ?org=, which remembers the choice.
 */
function OrgSwitcher({ current, ward, targets }: { current: SwitchTarget; ward: string; targets: SwitchTarget[] }) {
  const wards = [...new Set(targets.map((t) => t.ward))];
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  // Close the menu after choosing (the page changes underneath it).
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  return (
    <details ref={ref} className="relative min-w-0">
      <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-lg py-1 pr-2 font-semibold text-text [&::-webkit-details-marker]:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate">{current.label}</span>
          {current.label !== ward && <span className="block truncate text-xs font-normal text-muted">{ward}</span>}
        </span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" fill="currentColor" aria-hidden>
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">Switch organization</span>
      </summary>
      <div className="absolute left-0 z-40 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-lg">
        {wards.map((w) => (
          <div key={w} className="mb-1">
            {wards.length > 1 && <div className="px-2 pt-1 pb-0.5 text-xs font-semibold text-muted uppercase">{w}</div>}
            {targets
              .filter((t) => t.ward === w)
              .map((t) => (
                <a
                  key={t.id}
                  href={`/?org=${t.id}`}
                  className={`block rounded-lg px-3 py-2 text-sm ${t.id === current.id ? "bg-accent-soft font-semibold text-accent" : "hover:bg-surface-2"}`}
                >
                  {t.label}
                </a>
              ))}
          </div>
        ))}
        <Link href="/more/organizations" className="mt-1 block border-t border-border px-3 pt-2 pb-1 text-sm text-accent">
          My organizations and notifications
        </Link>
      </div>
    </details>
  );
}

export function Nav({
  current,
  ward,
  targets,
  features,
  isAdmin,
  adminCount,
  moreCount = 0,
  messagesCount = 0,
}: {
  current: SwitchTarget;
  ward: string;
  targets: SwitchTarget[];
  features: { lessons: boolean; signups: boolean; plans: boolean };
  isAdmin: boolean;
  adminCount: number;
  moreCount?: number;
  /** Unread messages: answers to them, and (for leaders) members writing to them. */
  messagesCount?: number;
}) {
  const path = usePathname();
  const router = useRouter();
  const tabBar = useRef<HTMLElement>(null);
  useStickToBottom(tabBar);
  // The bar isn't reloaded when moving between pages, so a count can go stale
  // once something is read or handled. While a count shows, check it again
  // on each page change.
  const lastPath = useRef(path);
  const showingCounts = !!(adminCount || moreCount || messagesCount);
  useEffect(() => {
    if (lastPath.current === path) return;
    lastPath.current = path;
    if (showingCounts) router.refresh();
  }, [path, showingCounts, router]);
  // The page being read clears these, so don't show the dot there.
  if (path.startsWith("/notifications")) moreCount = 0;
  // Lessons and Plans only where the organization uses them; Sign-ups takes a free spot.
  const main: Item[] = [
    { href: "/", label: "Home", icon: "home" },
    ...(features.lessons ? [{ href: "/lessons", label: "Lessons", icon: "book" }] : []),
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    ...(features.plans ? [{ href: "/plans", label: "Plans", icon: "plan" }] : []),
  ];
  if (main.length < 4 && features.signups) main.push({ href: "/signups", label: "Service", icon: "list" });
  const desktopExtra: Item[] = [
    ...(features.signups && !main.some((i) => i.href === "/signups") ? [{ href: "/signups", label: "Service", icon: "list" }] : []),
    { href: "/messages", label: "Messages", icon: "chat", badge: messagesCount },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "shield", badge: adminCount }] : []),
    { href: "/more", label: "More", icon: "more", badge: moreCount },
  ];

  const tabs: Item[] = [...main, { href: "/more", label: "More", icon: "more", badge: moreCount }];
  const activeTab = tabs.find((i) => isActive(path, i.href))?.href ?? null;
  // In the phone app, the app draws the tab bar natively (and badges its icon); its
  // taps come back through window.__mwlNavigate.
  const tabsKey = JSON.stringify([tabs, activeTab]);
  useEffect(() => {
    if (!appHasTabs()) return;
    (window as Window & { __mwlNavigate?: (href: string) => void }).__mwlNavigate = (href) => router.push(href);
    const [items, active] = JSON.parse(tabsKey) as [Item[], string | null];
    postToApp({ type: "tabs", items, active });
  }, [tabsKey, router]);
  useEffect(() => {
    if (appHasTabs()) postToApp({ type: "badge", count: messagesCount + moreCount });
  }, [messagesCount, moreCount]);
  useEffect(() => {
    sendWidgetKey();
    return () => {
      if (appHasTabs()) postToApp({ type: "tabs", items: [], active: null });
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <OrgSwitcher current={current} ward={ward} targets={targets} />
          <nav className="web-topnav ml-auto hidden items-center gap-1 md:flex">
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
          {/* Phones: Messages and Admin sit in the header (the tab bar has no room). */}
          <Link href="/messages" aria-label={`Messages${messagesCount ? `, ${messagesCount} unread` : ""}`} className="app-header-item relative ml-auto rounded-lg p-1.5 text-accent md:hidden">
            <Icon name="chat" />
            {messagesCount > 0 && (
              <span className="absolute -top-0.5 -right-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white">{messagesCount}</span>
            )}
          </Link>
          {isAdmin && (
            <Link href="/admin" className="app-header-item relative rounded-lg px-2 py-1 text-sm font-medium text-accent md:hidden">
              Admin
              {adminCount > 0 && <span className="ml-1 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{adminCount}</span>}
            </Link>
          )}
        </div>
      </header>

      <nav ref={tabBar} className="web-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-opacity md:hidden">
        <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((i) => (
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
