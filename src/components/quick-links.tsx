"use client";

import { useEffect, useState, type ReactNode } from "react";

type Platform = "ios" | "android" | "desktop";

// Each link opens the app when it's installed and falls back to the store or website.
const LINKS: Record<"library" | "tools", { name: string; desc: string; icon: ReactNode; href: Record<Platform, string> }> = {
  library: {
    name: "Gospel Library",
    desc: "Scriptures, conference talks and manuals",
    icon: <OpenBook />,
    href: {
      ios: "https://www.churchofjesuschrist.org/study?lang=eng",
      android: "intent://#Intent;package=org.lds.ldssa;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dorg.lds.ldssa;end",
      desktop: "https://www.churchofjesuschrist.org/study?lang=eng",
    },
  },
  tools: {
    name: "Member Tools",
    desc: "Ward directory, callings and calendars",
    icon: <BlueToolbox />,
    href: {
      ios: "https://apps.apple.com/app/id391093033",
      android: "intent://#Intent;package=org.lds.ldstools;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dorg.lds.ldstools;end",
      desktop: "https://directory.churchofjesuschrist.org/",
    },
  },
};

/** An open book (drawn, so it looks the same on every phone and computer). */
function OpenBook() {
  return (
    <svg viewBox="0 0 32 32" className="inline-block h-[1em] w-[1em]" aria-hidden>
      <path d="M2 8.5C6 7 11 7 16 9.5 21 7 26 7 30 8.5V26c-4-1.5-9-1.5-14 1-5-2.5-10-2.5-14-1z" fill="#1e3a8a" />
      <path d="M4 9.5c3.5-1 7.5-.8 11 1.2V25c-3.5-1.8-7.5-2-11-1.2z" fill="#dbeafe" />
      <path d="M28 9.5c-3.5-1-7.5-.8-11 1.2V25c3.5-1.8 7.5-2 11-1.2z" fill="#bfdbfe" />
      <path d="M6.5 13c2.4-.4 4.8-.1 6.5.8M6.5 16.5c2.4-.4 4.8-.1 6.5.8M19 13.8c1.7-.9 4.1-1.2 6.5-.8M19 17.3c1.7-.9 4.1-1.2 6.5-.8" stroke="#2563eb" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** A blue toolbox (drawn, so it's the same color on every phone and computer). */
function BlueToolbox() {
  return (
    <svg viewBox="0 0 32 32" className="inline-block h-[1em] w-[1em]" aria-hidden>
      <path d="M11 9V6.5A1.5 1.5 0 0 1 12.5 5h7A1.5 1.5 0 0 1 21 6.5V9h-2.5V7.5h-5V9z" fill="#1e3a8a" />
      <rect x="3" y="9" width="26" height="18" rx="3" fill="#2563eb" />
      <rect x="3" y="15" width="26" height="2.5" fill="#1d4ed8" />
      <rect x="7.5" y="13" width="3" height="6.5" rx="1" fill="#bfdbfe" />
      <rect x="21.5" y="13" width="3" height="6.5" rx="1" fill="#bfdbfe" />
      <rect x="5" y="11" width="22" height="1.5" rx=".75" fill="#60a5fa" opacity=".6" />
    </svg>
  );
}

export function QuickLinks() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? "ios" : /android/i.test(ua) ? "android" : "desktop");
  }, []);
  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.values(LINKS).map((l) => (
        <a key={l.name} href={l.href[platform]} target={platform === "android" ? undefined : "_blank"} rel="noreferrer" className="card flex flex-col gap-1 p-3 hover:bg-surface-2 sm:p-4">
          <span className="text-2xl" aria-hidden>
            {l.icon}
          </span>
          <span className="font-semibold">{l.name}</span>
          <span className="text-xs text-muted">{l.desc}</span>
        </a>
      ))}
    </div>
  );
}
