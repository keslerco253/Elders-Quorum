import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { adminCounts } from "@/lib/admin-counts";
import { Nav } from "@/components/nav";
import { hasFeature, ledOrgsAnywhere, orgLabel, orgsInWard } from "@/lib/orgs";
import { leaderUnread, unreadAnswers } from "@/lib/conversations";
import { unreadAnnouncements } from "@/lib/member-inbox";
import { unreadNotifications } from "@/lib/notification-log";
import { NotificationSeen } from "@/components/notification-seen";
import { StayFresh } from "@/components/stay-fresh";
import { Disclaimer } from "@/components/disclaimer";

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
        features={{ lessons: hasFeature(user.org, "lessons"), signups: hasFeature(user.org, "signups") }}
        // Leaders keep the Admin tab while looking at another organization; it shows where to switch.
        isAdmin={isAdmin(user) || ledOrgsAnywhere(user.id).length > 0}
        adminCount={counts.total}
        moreCount={unreadNotifications(user.id)}
        messagesCount={unreadAnswers(user.id) + unreadAnnouncements(user.id) + leaderUnread(user.id)}
      />
      <NotificationSeen />
      <StayFresh />
      <main className="app-main mx-auto max-w-5xl px-4 pt-5 pb-28 md:pb-12">
        {children}
        <Disclaimer className="mt-12" />
      </main>
    </>
  );
}
