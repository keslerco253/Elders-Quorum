"use client";

import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "desktop";

// Each link opens the app when it's installed and falls back to the store or website.
const LINKS: Record<"library" | "tools", { name: string; desc: string; emoji: string; href: Record<Platform, string> }> = {
  library: {
    name: "Gospel Library",
    desc: "Scriptures, conference talks and manuals",
    emoji: "📖",
    href: {
      ios: "https://www.churchofjesuschrist.org/study?lang=eng",
      android: "intent://#Intent;package=org.lds.ldssa;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dorg.lds.ldssa;end",
      desktop: "https://www.churchofjesuschrist.org/study?lang=eng",
    },
  },
  tools: {
    name: "Member Tools",
    desc: "Ward directory, callings and calendars",
    emoji: "🧰",
    href: {
      ios: "https://apps.apple.com/app/id391093033",
      android: "intent://#Intent;package=org.lds.ldstools;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dorg.lds.ldstools;end",
      desktop: "https://directory.churchofjesuschrist.org/",
    },
  },
};

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
            {l.emoji}
          </span>
          <span className="font-semibold">{l.name}</span>
          <span className="text-xs text-muted">{l.desc}</span>
        </a>
      ))}
    </div>
  );
}
