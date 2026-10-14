import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { adminCounts } from "@/lib/admin-counts";
import { Nav } from "@/components/nav";
import { hasFeature, orgLabel, orgsInWard } from "@/lib/orgs";
import { unreadAnswers } from "@/lib/conversations";
import { unreadNotifications } from "@/lib/notification-log";
import { NotificationSeen } from "@/components/notification-seen";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = adminCounts(user);
  // Every organization in every ward the member is in, for the switcher.
  const targets = user.wards.flatMap((w) => orgsInWard(w.id).map((o) => ({ id: o.id, label: orgLabel(o, w), ward: w.name })));
  return (
    <>
      <Nav
        current={{ id: user.org_id, label: user.orgLabel, ward: user.ward.name }}
        ward={user.ward.name}
        targets={targets}
        features={{ lessons: hasFeature(user.org, "lessons"), plans: hasFeature(user.org, "plans"), signups: hasFeature(user.org, "signups") }}
        isAdmin={isAdmin(user)}
        adminCount={counts.total}
        moreCount={unreadAnswers(user.id) + unreadNotifications(user.id)}
      />
      <NotificationSeen />
      <main className="mx-auto max-w-5xl px-4 pt-5 pb-28 md:pb-12">{children}</main>
    </>
  );
}
