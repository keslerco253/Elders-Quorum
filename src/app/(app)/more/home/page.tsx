import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { HOME_SECTIONS, homeLayout } from "@/lib/home-layout";
import { moveSection, resetLayout, toggleSection } from "./actions";

export const metadata = { title: "Customize Home" };

export default async function CustomizeHomePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const layout = homeLayout(user.id);
  const info = new Map(HOME_SECTIONS.map((s) => [s.key, s]));
  const arrow = "flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-lg hover:bg-surface-2 disabled:opacity-30";
  return (
    <>
      <PageHeader
        title="Customize Home"
        back={{ href: "/more", label: "More" }}
        subtitle="Put your Home page sections in the order you like, and hide ones you don't use. Only you see this, on your phone and computer alike."
      />
      <Flash msg={sp.msg} tone="success" />
      <div className="max-w-xl space-y-4">
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {layout.order.map((key, i) => {
            const s = info.get(key)!;
            const hidden = layout.hidden.includes(key);
            return (
              <li key={key} className="flex items-center gap-2 px-3 py-2">
                <form action={moveSection} className="flex gap-1">
                  <input type="hidden" name="key" value={key} />
                  <button name="dir" value="up" className={arrow} disabled={i === 0} aria-label={`Move ${s.label} up`}>
                    ↑
                  </button>
                  <button name="dir" value="down" className={arrow} disabled={i === layout.order.length - 1} aria-label={`Move ${s.label} down`}>
                    ↓
                  </button>
                </form>
                <span className={`min-w-0 flex-1 ${hidden ? "text-muted" : ""}`}>
                  <span className="block font-medium">{s.label}</span>
                  {"note" in s && <span className="text-xs text-muted">{s.note}</span>}
                </span>
                {hidden && <Badge tone="neutral">Hidden</Badge>}
                <form action={toggleSection}>
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="hide" value={hidden ? "0" : "1"} />
                  <button className="btn-secondary px-3 py-1.5 text-sm">{hidden ? "Show" : "Hide"}</button>
                </form>
              </li>
            );
          })}
        </ul>
        <p className="hint">
          Things that need an answer, like items waiting on you, &ldquo;Will you teach?&rdquo;, &ldquo;Can you conduct?&rdquo; and visit invitations, always stay at the top. A
          section with nothing in it for you (no challenge running, say) doesn&apos;t show either way. Hidden sections are still in their tabs and under More.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="btn-primary">
            Done
          </Link>
          {layout.custom && (
            <form action={resetLayout}>
              <button className="btn-secondary">Reset to the usual order</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
