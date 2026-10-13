import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { markNotificationsRead, notificationsFor } from "@/lib/notification-log";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const list = notificationsFor(user.id);
  // Seeing the list counts as reading them.
  markNotificationsRead(user.id);
  return (
    <>
      <PageHeader title="Notifications" back={{ href: "/more", label: "More" }} subtitle="Everything the app sent you in the last 30 days, in full." />
      {list.length === 0 ? (
        <Empty>No notifications yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id} className={`card space-y-1 ${n.read_at ? "" : "border-accent"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {!n.read_at && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" aria-label="New" />}
                  {n.title}
                </span>
                <span className="text-xs text-muted">{formatDateTime(n.created_at, user.ward.timezone, "LLL d, h:mm a")}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              {n.url && n.url !== "/" && (
                <Link href={n.url} className="link inline-block pt-1 text-sm">
                  Open ›
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="hint mt-4">
        Want notifications to stay on screen until you tap them? On iPhone: <strong>Settings → Notifications → {user.ward.name} → Banner Style → Persistent</strong>.
      </p>
    </>
  );
}
