import { OrgLink } from "@/components/org-link";
import { requireUser } from "@/lib/auth";
import { notificationsFor } from "@/lib/notification-log";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHeader } from "@/components/ui";
import { markRead } from "./actions";

export const metadata = { title: "Reminders & alerts" };

/** The notification's page, with ?n=<id> so opening it marks this one read. */
function openUrl(url: string, id: number) {
  const [path, hash = ""] = url.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}n=${id}${hash ? `#${hash}` : ""}`;
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const list = notificationsFor(user.id);
  const unread = list.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader
        title="Reminders & alerts"
        back={{ href: "/more", label: "More" }}
        subtitle="Every reminder and alert the app sent you in the last 30 days, in full. Messages and replies are in Messages. A red dot stays until you tap it."
        actions={
          unread > 0 && (
            <form action={markRead}>
              <button className="btn-secondary btn-sm">Mark all as read</button>
            </form>
          )
        }
      />
      {list.length === 0 ? (
        <Empty>No reminders or alerts yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => {
            const inner = (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={n.read_at ? "font-medium" : "font-bold"}>
                    {!n.read_at && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-danger align-middle" aria-label="New" />}
                    {n.title}
                  </span>
                  <span className="text-xs text-muted">{formatDateTime(n.created_at, user.ward.timezone, "LLL d, h:mm a")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                {n.url && n.url !== "/" && <span className="link inline-block pt-1 text-sm">Open ›</span>}
              </>
            );
            const cls = `card block w-full space-y-1 text-left hover:bg-surface-2 ${n.read_at ? "" : "border-accent"}`;
            return (
              <li key={n.id}>
                {n.url && n.url !== "/" ? (
                  <OrgLink href={openUrl(n.url, n.id)} className={cls}>
                    {inner}
                  </OrgLink>
                ) : n.read_at ? (
                  <div className={cls.replace(" hover:bg-surface-2", "")}>{inner}</div>
                ) : (
                  <form action={markRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className={cls}>{inner}</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="hint mt-4">
        Want notifications to stay on screen until you tap them? On iPhone: <strong>Settings → Notifications → {user.ward.name} → Banner Style → Persistent</strong>.
      </p>
    </>
  );
}
