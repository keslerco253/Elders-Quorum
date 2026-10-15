import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { ledOrgsAnywhere } from "@/lib/orgs";
import { leaderGuide } from "@/lib/guide";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Leader guide" };

/** How to use the app as a leader: for anyone in a presidency or bishopric. */
export default async function LeaderGuidePage() {
  const user = await requireUser();
  if (!isAdmin(user) && ledOrgsAnywhere(user.id).length === 0) redirect("/");
  const guide = leaderGuide();
  return (
    <>
      <PageHeader title="Leader guide" back={{ href: "/admin", label: "Admin" }} subtitle="How to do everything in the app as a leader. Tap a topic to jump to it." />
      {!guide ? (
        <p className="text-sm text-muted">The guide isn&apos;t available right now.</p>
      ) : (
        <>
          <nav className="card mb-6 text-sm" aria-label="Topics">
            <div className="mb-2 font-semibold">Topics</div>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {guide.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="link">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <article className="prose-eq guide max-w-3xl" dangerouslySetInnerHTML={{ __html: guide.html }} />
        </>
      )}
    </>
  );
}
