import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { adminCounts } from "@/lib/admin-counts";
import { Nav } from "@/components/nav";
import { unreadAnswers } from "@/lib/conversations";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = adminCounts(user);
  return (
    <>
      <Nav appName={user.ward.name} isAdmin={isAdmin(user)} adminCount={counts.total} moreCount={unreadAnswers(user.id)} />
      <main className="mx-auto max-w-5xl px-4 pt-5 pb-28 md:pb-12">{children}</main>
    </>
  );
}
