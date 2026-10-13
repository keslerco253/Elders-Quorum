import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { adminCounts } from "@/lib/admin-counts";
import { isPresidency } from "@/lib/permissions";
import { PageHeader, Section } from "@/components/ui";
import { upcomingVisits } from "@/lib/planned-visits";

export const metadata = { title: "Admin" };

type Tile = { href: string; label: string; desc: string; count?: number; show?: boolean };

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles
        .filter((t) => t.show !== false)
        .map((t) => (
          <Link key={t.href} href={t.href} className="card flex items-start justify-between gap-3 hover:bg-surface-2">
            <span>
              <span className="block font-semibold">{t.label}</span>
              <span className="text-sm text-muted">{t.desc}</span>
            </span>
            {!!t.count && <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">{t.count}</span>}
          </Link>
        ))}
    </div>
  );
}

export default async function AdminPage() {
  const user = await requireAdmin();
  const c = adminCounts(user);
  const p = isPresidency(user);
  const planned = p ? upcomingVisits(user.ward_id).length : 0;
  const waiting: Tile[] = [
    { href: "/admin/replies", label: "Replies", desc: "Members writing back to the presidency", count: c.replies, show: p },
    { href: "/admin/visit-requests", label: "Visit requests", desc: "Members asking for a visit", count: c.visitRequests, show: p },
    { href: "/admin/notes", label: "Teacher notes to approve", desc: "Notes for the quorum before Sunday", count: c.notes },
    { href: "/admin/comments", label: "Comments to approve", desc: "Lesson comments and replies", count: c.comments },
    { href: "/admin/access", label: "Access requests", desc: "Requests to join without a code", count: c.access, show: p },
    { href: "/admin/event-requests", label: "Event requests", desc: "Suggested by members", count: c.eventRequests },
    { href: "/admin/lessons", label: "Teaching volunteers", desc: "Lessons with volunteers to assign", count: c.volunteers, show: p },
    { href: "/admin/lessons", label: "Teacher needed", desc: "A teacher or someone you asked can't teach", count: c.teacherNeeded, show: p },
  ];
  return (
    <>
      <PageHeader title="Admin" subtitle={p ? "Presidency tools" : "Admin tools"} />
      {c.total > 0 && (
        <Section title="Waiting on you">
          <Tiles tiles={waiting.filter((t) => t.count)} />
        </Section>
      )}
      <Section title="Quorum">
        <Tiles
          tiles={[
            { href: "/admin/invite", label: "Invite members", desc: "QR code and join link for quorum meeting" },
            { href: "/admin/messages", label: "Send a message", desc: "Push notification or email to a group" },
            { href: "/admin/lessons", label: "Lessons", desc: "Six-month schedule and teachers" },
            { href: "/admin/events/new", label: "Add an event", desc: "Activities and meetings" },
            { href: "/signups", label: "Sign-ups", desc: "Service projects and meals" },
            { href: "/plans", label: "Ward plans", desc: "Temple & family history, ward mission" },
            { href: "/admin/members", label: "Members", desc: "People who joined the app" },
          ]}
        />
      </Section>
      {p && (
        <Section title="Presidency only">
          <Tiles
            tiles={[
              { href: "/admin/replies", label: "Replies", desc: "Conversations with members" },
              { href: "/admin/visit-requests", label: "Visit requests", desc: "Members asking for a visit" },
              { href: "/admin/visits", label: "Home visits", desc: planned ? `${planned} upcoming · plan and record visits` : "Plan visits and record who we've visited" },
              { href: "/admin/todos", label: "Assignments", desc: "Presidency to-dos with due dates" },
              { href: "/admin/settings", label: "Settings", desc: "App name, time zone, email" },
            ]}
          />
        </Section>
      )}
      <Section title="Approvals and groups">
        <Tiles tiles={[{ href: "/admin/notes", label: "Teacher notes", desc: "Approve notes before they're shared" }, { href: "/admin/comments", label: "Comment queue", desc: "Approve study comments" }, { href: "/admin/event-requests", label: "Event requests", desc: "Approve or decline" }, { href: "/admin/groups", label: "Message groups", desc: "Custom groups for messages" }, ...(p ? [{ href: "/admin/access", label: "Access requests", desc: "Approve new people" }] : [])]} />
      </Section>
    </>
  );
}
