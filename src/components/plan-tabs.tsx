"use client";

import { useEffect, useState } from "react";

/**
 * Tabs on a plan page (Week 1, Week 2…), each with its dates and its text. It opens on
 * the tab whose start date has most recently come (or the first), and remembers the one
 * chosen in the address (#tab-2) so a link opens it.
 */
export function PlanTabs({ id, tabs }: { id: string; tabs: { label: string; sub: string; start: string; html: string }[] }) {
  const [open, setOpen] = useState(0);
  useEffect(() => {
    const m = location.hash.match(new RegExp(`^#${id}-(\\d+)$`));
    if (m && Number(m[1]) < tabs.length) return setOpen(Number(m[1]));
    const today = new Date().toLocaleDateString("en-CA");
    let pick = 0;
    tabs.forEach((t, i) => {
      if (t.start && t.start <= today) pick = i;
    });
    setOpen(pick);
  }, [id, tabs]);
  return (
    <div className="plan-tabs not-prose">
      <div role="tablist" className="plan-tab-list">
        {tabs.map((t, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={open === i}
            className={`plan-tab ${open === i ? "plan-tab-on" : ""}`}
            onClick={() => {
              setOpen(i);
              history.replaceState(null, "", `#${id}-${i}`);
            }}
          >
            <span className="plan-tab-label">{t.label}</span>
            {t.sub && <span className="plan-tab-sub">{t.sub}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={i} role="tabpanel" hidden={open !== i} className="plan-tab-panel prose-eq" dangerouslySetInnerHTML={{ __html: t.html }} />
      ))}
    </div>
  );
}
