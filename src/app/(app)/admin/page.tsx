import Link from "next/link";
import { requireAdminTab } from "@/lib/auth";
import { adminCounts, passOnCount } from "@/lib/admin-counts";
import { isAdmin, isPresidency } from "@/lib/permissions";
import { CountDot, PageHeader, Section } from "@/components/ui";
import { openInvitations, upcomingVisits } from "@/lib/planned-visits";
import { roleLabel, type Feature } from "@/lib/types";
import { hasFeature } from "@/lib/orgs";
import { pendingAgenda, recordsToReview } from "@/lib/meetings";
import { orgTodos } from "@/lib/assignments";
import { todayIn } from "@/lib/time";

export const metadata = { title: "Admin" };

type Tile = {
  href: string;
  label: string;
  desc: string;
  count?: number;
  show?: boolean;
};

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles
        .filter((t) => t.show !== false)
        .map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card flex items-start justify-between gap-3 hover:bg-surface-2"
          >
            <span>
              <span className="block font-semibold">{t.label}</span>
              <span className="text-sm text-muted">{t.desc}</span>
            </span>
            <CountDot n={t.count} label="waiting" />
          </Link>
        ))}
    </div>
  );
}

export default async function AdminPage() {
  const user = await requireAdminTab();
  // Ward tools: for ward administrators, the site owner and the backup person, even if
  // they don't lead the organization they're looking at.
  const passOn = passOnCount(user);
  const wardTiles: Tile[] = [
    ...(passOn ? [{ href: "/pass-on", label: "Pass it on", count: passOn, desc: "Members' messages that need passing on to the right organization" }] : []),
    ...(user.wardAdmin ? [{ href: "/ward-settings", label: "Ward settings", desc: `${user.ward.name}'s organizations, join code and ward administrators` }] : []),
    ...(user.is_site_owner ? [{ href: "/site", label: "Site owner", desc: "Every ward, texting, backups" }] : []),
  ];
  const wardSection = wardTiles.length > 0 && (
    <Section title="Ward">
      <Tiles tiles={wardTiles} />
    </Section>
  );
  if (!isAdmin(user)) {
    return (
      <>
        <PageHeader title="Admin" subtitle={`Ward tools for ${user.ward.name}`} />
        {wardSection}
      </>
    );
  }
  const c = adminCounts(user);
  const p = isPresidency(user);
  const has = (f: Feature) => hasFeature(user.org, f);
  const planned = p ? upcomingVisits(user.org_id).length : 0;
  const today = todayIn(user.ward.timezone);
  const planning = p && hasFeature(user.org, "todos");
  const agendaCount = planning ? pendingAgenda(user.org_id).length : 0;
  const toReview = planning ? recordsToReview(user.org_id, today).length : 0;
  const openTodos = planning ? orgTodos(user.org_id).filter((t) => !t.done) : [];
  const overdueTodos = openTodos.filter((t) => t.due_date && t.due_date < today).length;
  const inviting = p
    ? openInvitations(user.org_id).filter((v) => v.invite_status !== "declined")
        .length
    : 0;
  const waiting: Tile[] = [
    {
      href: "/admin/visit-requests",
      label: "Visit requests",
      desc: "Members asking for a visit",
      count: c.visitRequests,
      show: p && has("visits"),
    },
    {
      href: "/admin/visits",
      label: "Visit invitations",
      desc: "Members asked for another time",
      count: c.newTimes,
      show: p && has("visits"),
    },
    {
      href: "/admin/notes",
      label: "Teacher notes to approve",
      desc: "Notes for everyone before Sunday",
      count: c.notes,
    },
    {
      href: "/admin/comments",
      label: "Comments to approve",
      desc: "Lesson comments and replies",
      count: c.comments,
    },
    {
      href: "/admin/access",
      label: "Access requests",
      desc: "Old requests to join without a code",
      count: c.access,
      show: p,
    },
    {
      href: "/admin/event-requests",
      label: "Event requests",
      desc: "Suggested by members",
      count: c.eventRequests,
    },
    {
      href: c.volunteersHref,
      label: "Teaching volunteers",
      desc: "Lessons with volunteers to assign",
      count: c.volunteers,
      show: p,
    },
    {
      href: c.teacherNeededHref,
      label: "Teacher needed",
      desc: "A teacher or someone you asked can't teach",
      count: c.teacherNeeded,
      show: p,
    },
    {
      href: "/admin/todos?show=unassigned",
      label: "Unassigned assignments",
      desc: "No one has these (or the person was unable to do them)",
      count: c.unassigned,
      show: p && has("todos"),
    },
  ];
  return (
    <>
      <PageHeader
        title="Admin"
        subtitle={
          p
            ? `${roleLabel("presidency", user.org)} tools for ${user.orgLabel}`
            : `Admin tools for ${user.orgLabel}`
        }
      />
      {waiting.some((t) => t.count && t.show !== false) && (
        <Section title="Waiting on you">
          <Tiles tiles={waiting.filter((t) => t.count)} />
        </Section>
      )}
      {/* Sending messages, lessons, events, service and plans each have their own tab
          (New message, Manage lessons, Add event…), so they aren't repeated here. */}
      <Section title={roleLabel("presidency", user.org)}>
        <Tiles
          tiles={[
            ...(has("todos")
              ? [
                  {
                    href: "/admin/meetings",
                    label: "Presidency meetings",
                    count: toReview,
                    desc:
                      [agendaCount && `${agendaCount} on the next agenda`, toReview && `${toReview} to review`].filter(Boolean).join(" · ") ||
                      "Schedule, agenda, notes and Zoom",
                  },
                  {
                    href: "/admin/todos",
                    label: "Assignments",
                    count: overdueTodos,
                    desc: openTodos.length ? `${openTodos.length} open${overdueTodos ? ` · ${overdueTodos} overdue` : ""}` : "Give anyone an assignment with a due date",
                  },
                ]
              : []),
            ...(has("visits")
              ? [
                  {
                    href: "/admin/visits",
                    label: "Home visits",
                    count: c.newTimes,
                    desc:
                      [planned && `${planned} upcoming`, inviting && `${inviting} invitation${inviting === 1 ? "" : "s"} open`].filter(Boolean).join(" · ") ||
                      "Plan visits and record who we've visited",
                  },
                  {
                    href: "/admin/visit-requests",
                    label: "Visit requests",
                    desc: "Members asking for a visit",
                    count: c.visitRequests,
                  },
                ]
              : []),
            {
              href: "/admin/challenges",
              label: "Challenges",
              desc: "Friendly competitions between organizations",
            },
            {
              href: "/admin/members",
              label: "Members",
              desc: `People in ${user.orgLabel}, callings and access`,
            },
            {
              href: "/admin/invite",
              label: "Invite members",
              desc: "QR code and join link for the ward",
            },
          ]}
        />
      </Section>
      {wardSection}
      <Section title="Setup">
        <Tiles
          tiles={[
            {
              href: "/admin/groups",
              label: "Message groups",
              desc: "Custom groups to send messages to",
            },
            {
              href: "/admin/shared",
              label: "Shared publicly",
              desc: "Links and QR codes for flyers and sign-ups, open to anyone",
            },
            {
              href: "/admin/templates",
              label: "Message wording",
              desc: "Reminders and texts the app sends, in your own words",
            },
            {
              href: "/admin/settings",
              label: "Settings",
              desc: "Name and features",
            },
            {
              href: "/admin/guide",
              label: "Leader guide",
              desc: "How to do everything in the app as a leader",
            },
          ]}
        />
      </Section>
    </>
  );
}
