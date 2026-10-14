import { requireUser } from "@/lib/auth";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { callingLabel, roleLabel } from "@/lib/types";
import { joinAnotherWard, saveMyOrganizations } from "./actions";

export const metadata = { title: "My organizations" };

export default async function MyOrganizationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const groups = user.orgs.filter((o) => o.kind === "group");
  const wardOrg = user.orgs.find((o) => o.kind === "ward");
  return (
    <>
      <PageHeader title="My organizations" back={{ href: "/more", label: "More" }} subtitle={`In ${user.ward.name}. You can see every organization; these choices are about you.`} />
      <Flash msg={sp.msg} tone={sp.ok ? "success" : "warn"} />
      <form action={saveMyOrganizations} className="space-y-4">
        <Section title="Organizations">
          {groups.length === 0 ? (
            <p className="card text-sm text-muted">{user.ward.name} hasn&apos;t added any organizations yet.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {groups.map((o) => (
                <li key={o.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{o.label}</span>
                    {o.role !== "member" && <Badge tone="info">{o.calling ? callingLabel(o.calling, o) : roleLabel(o.role, o)}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name={`official_${o.id}`} defaultChecked={o.official} /> I belong to {o.label}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name={`notify_${o.id}`} defaultChecked={o.notify || o.role !== "member"} disabled={o.role !== "member"} /> Send me its notifications
                      {o.role !== "member" && <input type="hidden" name={`notify_${o.id}`} value="on" />}
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="hint mt-2">
            &quot;I belong&quot; puts you on that organization&apos;s member list for its leaders (visits, teaching, messages). Notifications are its reminders, events and
            messages. Leaders always get their organization&apos;s notifications.
          </p>
        </Section>
        {wardOrg && (
          <Section title={user.ward.name}>
            <label className="card flex items-center gap-2 text-sm">
              <input type="checkbox" name={`notify_${wardOrg.id}`} defaultChecked={wardOrg.notify || wardOrg.role !== "member"} disabled={wardOrg.role !== "member"} /> Send me
              ward-wide notifications (from the bishopric)
              {wardOrg.role !== "member" && <input type="hidden" name={`notify_${wardOrg.id}`} value="on" />}
            </label>
          </Section>
        )}
        <SubmitButton>Save</SubmitButton>
      </form>

      <Section title="Another ward">
        <form action={joinAnotherWard} className="card max-w-md space-y-3">
          <p className="text-sm text-muted">
            In {user.wards.map((w) => w.name).join(", ")}. To join another ward too (for example, for a stake calling), enter its join code. Switch between wards with the menu at the
            top.
          </p>
          <input name="join_code" required className="input" autoCapitalize="characters" autoComplete="off" placeholder="Join code" />
          <SubmitButton className="btn-secondary">Join ward</SubmitButton>
        </form>
      </Section>
    </>
  );
}
