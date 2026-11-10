import { homeOf } from "@/lib/orgs";
import { PageHeader } from "./ui";
import type { CurrentUser } from "@/lib/types";

/**
 * In support view (the site owner looking into a ward they aren't in), pages built from
 * the owner's own memberships (their messages, assignments, alerts, organizations)
 * would show their own ward's people and details inside another ward. They show this
 * instead, so nothing crosses from one ward to another.
 */
export function SupportNotice({ user, title, what }: { user: CurrentUser; title: string; what: string }) {
  const home = homeOf(user.id);
  return (
    <>
      <PageHeader title={title} />
      <div className="card max-w-xl space-y-3 text-sm">
        <p>
          <strong>Not shown in support view.</strong> {what} You&apos;re looking into {user.ward.name}, so nothing from {home.name} is shown here, and{" "}
          {user.ward.name}&apos;s private messages stay between its members and leaders.
        </p>
        {home.orgId && (
          <a href={`/?org=${home.orgId}`} className="btn-secondary btn-sm inline-flex">
            Back to {home.name}
          </a>
        )}
      </div>
    </>
  );
}
