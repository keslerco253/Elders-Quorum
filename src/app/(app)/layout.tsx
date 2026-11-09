import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { adminCounts, hasAdminTab, passOnCount } from "@/lib/admin-counts";
import { Nav } from "@/components/nav";
import { hasFeature, homeOf, ledOrgsAnywhere, orgLabel, orgsInWard } from "@/lib/orgs";
import { leaderUnread, unreadAnswers } from "@/lib/conversations";
import { unreadAnnouncements } from "@/lib/member-inbox";
import { unreadNotifications } from "@/lib/notification-log";
import { NotificationSeen } from "@/components/notification-seen";
import { StayFresh } from "@/components/stay-fresh";
import { PushOwner } from "@/components/push-owner";
import { Disclaimer } from "@/components/disclaimer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = adminCounts(user);
  // Every organization in every ward the member is in, for the switcher.
  // (In support view, the ward being looked into too.)
  const wards = user.support ? [user.ward, ...user.wards] : user.wards;
  const targets = wards.flatMap((w) => orgsInWard(w.id).map((o) => ({ id: o.id, label: orgLabel(o, w), ward: w.name })));
  const home = user.support ? homeOf(user.id).orgId : null;
  return (
    <>
      <Nav
        current={{ id: user.org_id, label: user.orgLabel, ward: user.ward.name }}
        ward={user.ward.name}
        targets={targets}
        features={{ lessons: hasFeature(user.org, "lessons"), signups: hasFeature(user.org, "signups"), plans: hasFeature(user.org, "plans") }}
        // Leaders keep the Admin tab while looking at another organization; it shows where to switch.
        // Ward administrators, the site owner and the backup person have theirs there too.
        isAdmin={isAdmin(user) || ledOrgsAnywhere(user.id).length > 0 || hasAdminTab(user)}
        adminCount={counts.total + passOnCount(user)}
        moreCount={unreadNotifications(user.id)}
        messagesCount={unreadAnswers(user.id) + unreadAnnouncements(user.id) + leaderUnread(user.id)}
      />
      <NotificationSeen />
      <StayFresh />
      <PushOwner memberId={user.id} />
      <main className="app-main mx-auto max-w-5xl px-4 pt-5 pb-28 md:pb-12">
        {user.support && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-warn bg-warn-soft px-4 py-2.5 text-sm text-warn">
            <span>
              <strong>Support view: {user.ward.name}.</strong> You can see and fix anything here as site owner. You aren&apos;t a member, so you&apos;re not listed or
              notified.
            </span>
            <span className="flex gap-3">
              <a href="/site" className="font-semibold underline">
                Site owner
              </a>
              {home && (
                <a href={`/?org=${home}`} className="font-semibold underline">
                  Leave
                </a>
              )}
            </span>
          </div>
        )}
        {children}
        <Disclaimer className="mt-12" />
      </main>
    </>
  );
}
