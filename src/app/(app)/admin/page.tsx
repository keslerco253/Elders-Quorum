import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { adminCounts } from "@/lib/admin-counts";
import { isPresidency } from "@/lib/permissions";
import { CountDot, PageHeader, Section } from "@/components/ui";
import { openInvitations, upcomingVisits } from "@/lib/planned-visits";
import { leadersWord, roleLabel, type Feature } from "@/lib/types";
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
  const user = await requireAdmin();
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
      href: "/messages?show=unread",
      label: "Messages",
      desc: `Members writing to the ${leadersWord(user.org)}`,
      count: c.replies,
      show: p,
    },
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
      href: "/admin/lessons",
      label: "Teaching volunteers",
      desc: "Lessons with volunteers to assign",
      count: c.volunteers,
      show: p,
    },
    {
      href: "/admin/lessons",
      label: "Teacher needed",
      desc: "A teacher or someone you asked can't teach",
      count: c.teacherNeeded,
      show: p,
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
      <Section title={user.orgLabel}>
        <Tiles
          tiles={[
            {
              href: "/admin/guide",
              label: "Leader guide",
              desc: "How to do everything in the app as a leader",
            },
            ...(isPresidency(user)
              ? [
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
                ]
              : []),
            {
              href: "/admin/invite",
              label: "Invite members",
              desc: "QR code and join link for the ward",
            },
            {
              href: "/messages/new",
              label: "Send a message",
              desc: "Push notification or email to a group",
            },
            ...(has("lessons")
              ? [
                  {
                    href: "/admin/lessons",
                    label: "Lessons",
                    desc: "Six-month schedule and teachers",
                    count: c.volunteers + c.teacherNeeded,
                  },
                ]
              : []),
            {
              href: "/admin/events/new",
              label: "Add an event",
              desc: "Activities and meetings",
            },
            ...(has("signups")
              ? [
                  {
                    href: "/signups",
                    label: "Service",
                    desc: "Service projects and meals",
                  },
                ]
              : []),
            {
              href: "/plans",
              label: "Plans",
              desc: "Temple & family history, ward mission, and more",
            },
            {
              href: "/admin/members",
              label: "Members",
              desc: `People in ${user.orgLabel}`,
            },
          ]}
        />
      </Section>
      {p && (
        <Section title={`${roleLabel("presidency", user.org)} only`}>
          <Tiles
            tiles={[
              {
                href: "/messages",
                label: "Messages",
                desc: "Your inbox of conversations with members",
                count: c.replies,
              },
              ...(has("visits")
                ? [
                    {
                      href: "/admin/visit-requests",
                      label: "Visit requests",
                      desc: "Members asking for a visit",
                      count: c.visitRequests,
                    },
                    {
                      href: "/admin/visits",
                      label: "Home visits",
                      count: c.newTimes,
                      desc:
                        [
                          planned && `${planned} upcoming`,
                          inviting &&
                            `${inviting} invitation${inviting === 1 ? "" : "s"} open`,
                        ]
                          .filter(Boolean)
                          .join(" · ") ||
                        "Plan visits and record who we've visited",
                    },
                  ]
                : []),
              ...(has("todos")
                ? [
                    {
                      href: "/admin/meetings",
                      label: "Presidency meetings",
                      count: toReview,
                      desc:
                        [agendaCount && `${agendaCount} on the next agenda`, toReview && `${toReview} to review`].filter(Boolean).join(" · ") ||
                        "Agenda, notes and what was decided",
                    },
                    {
                      href: "/admin/todos",
                      label: "Assignments",
                      count: overdueTodos,
                      desc: openTodos.length ? `${openTodos.length} open${overdueTodos ? ` · ${overdueTodos} overdue` : ""}` : "Give anyone an assignment with a due date",
                    },
                  ]
                : []),
              {
                href: "/admin/settings",
                label: "Settings",
                desc:
                  user.wardLeader && user.org.kind === "ward"
                    ? "Ward, join code, organizations"
                    : "Name and features",
              },
            ]}
          />
        </Section>
      )}
      <Section title="Approvals and groups">
        <Tiles
          tiles={[
            ...(has("lessons")
              ? [
                  {
                    href: "/admin/notes",
                    label: "Teacher notes",
                    desc: "Approve notes before they're shared",
                    count: c.notes,
                  },
                  {
                    href: "/admin/comments",
                    label: "Comment queue",
                    desc: "Approve study comments",
                    count: c.comments,
                  },
                ]
              : []),
            {
              href: "/admin/event-requests",
              label: "Event requests",
              desc: "Approve or decline",
              count: c.eventRequests,
            },
            {
              href: "/admin/groups",
              label: "Message groups",
              desc: "Custom groups for messages",
            },
            ...(p && c.access
              ? [
                  {
                    href: "/admin/access",
                    label: "Access requests",
                    desc: "Approve new people",
                    count: c.access,
                  },
                ]
              : []),
          ]}
        />
      </Section>
    </>
  );
}
