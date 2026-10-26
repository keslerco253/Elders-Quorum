import Link from "next/link";
import { requireWardAdmin } from "@/lib/auth";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { formatPhone } from "@/lib/contact";
import { formatDateTime } from "@/lib/time";
import { NEW_MEMBER_DAYS, newMembersToReview, newWardMembers } from "@/lib/new-members";
import { newMemberLooksGood, removeNewMember } from "./actions";
import { roleIn, wardOrg } from "@/lib/orgs";
import { withOrg } from "@/lib/org-cookie";

export const metadata = { title: "New members" };

const HOW = { code: "Joined with the join code", leader: "Added by a leader", existing: "Joined with an account they already had" };

/**
 * Who joined the ward lately, for its ward administrators: anyone who doesn't belong
 * (the join code got shared too widely, a typo, another ward) can be taken out.
 */
export default async function NewMembersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireWardAdmin();
  const sp = await searchParams;
  const all = sp.view === "all";
  const toReview = newMembersToReview(user.ward_id);
  const people = newWardMembers(user.ward_id, { toReviewOnly: !all });
  const tz = user.ward.timezone;
  const view = all ? "all" : "";
  // Their member page is the bishopric's (the ward's Admin → Members).
  const canOpen = roleIn(user.id, wardOrg(user.ward_id).id) === "presidency";

  return (
    <>
      <PageHeader
        title="New members"
        back={{ href: "/admin", label: "Admin" }}
        subtitle={`Everyone who joined ${user.ward.name} in the last ${NEW_MEMBER_DAYS} days. Tap Looks good for each person who belongs. If someone doesn't, Remove from ward takes them out of the ward and its organizations (and deletes their account if they're in no other ward; they could join again with the code). If the join code was shared too widely, make a new one under Ward settings.`}
      />
      <Flash msg={sp.msg} />
      <div className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
        {[
          [false, "/ward-settings/new-members", `To review${toReview ? ` (${toReview})` : ""}`],
          [true, "/ward-settings/new-members?view=all", `All new (${NEW_MEMBER_DAYS} days)`],
        ].map(([isAll, href, label]) => (
          <Link
            key={String(href)}
            href={String(href)}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${isAll === all ? "bg-surface shadow-sm" : "text-muted hover:text-text"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {people.length === 0 ? (
        <Empty>{all ? `No one new in the last ${NEW_MEMBER_DAYS} days.` : "Nothing to review. New members show here as they join."}</Empty>
      ) : (
        <ul className="space-y-3">
          {people.map((p) => (
            <li key={p.id} className="card space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {canOpen ? (
                  <Link href={withOrg(`/admin/members/${p.id}`, wardOrg(user.ward_id).id)} className="mr-auto text-base font-semibold hover:underline">
                    {p.display_name}
                  </Link>
                ) : (
                  <span className="mr-auto text-base font-semibold">{p.display_name}</span>
                )}
                {!p.last_login_at && <Badge tone="warn">Hasn&apos;t signed in yet</Badge>}
                {p.status === "inactive" && <Badge tone="danger">Turned off</Badge>}
                {p.reviewed_at && <Badge tone="success">Reviewed</Badge>}
              </div>
              <div className="text-muted">
                {HOW[p.how]} · {formatDateTime(p.joined_at.replace(" ", "T") + "Z", tz, "LLL d, h:mm a")}
              </div>
              <div>
                {[p.phone && formatPhone(p.phone), p.email].filter(Boolean).join(" · ") || "No phone or email"}
              </div>
              <div className="text-muted">
                {p.orgs.length ? `Organizations: ${p.orgs.join(", ")}` : "Hasn't chosen any organizations yet"}
                {p.other_wards > 0 && ` · Also in ${p.other_wards === 1 ? "another ward" : `${p.other_wards} other wards`}`}
                {p.last_login_at && ` · Last signed in ${formatDateTime(p.last_login_at, tz, "LLL d")}`}
              </div>
              {p.reviewed_at && p.reviewed_by_name && <div className="text-xs text-muted">Reviewed by {p.reviewed_by_name}</div>}
              <div className="flex flex-wrap gap-2 pt-1">
                {!p.reviewed_at && (
                  <form action={newMemberLooksGood}>
                    <input type="hidden" name="member_id" value={p.id} />
                    <input type="hidden" name="view" value={view} />
                    <SubmitButton className="btn-primary btn-sm" pendingText="…">
                      Looks good
                    </SubmitButton>
                  </form>
                )}
                {p.id !== user.id && (
                  <form action={removeNewMember}>
                    <input type="hidden" name="member_id" value={p.id} />
                    <input type="hidden" name="view" value={view} />
                    <SubmitButton
                      className="btn-danger btn-sm"
                      confirm={`Remove ${p.display_name} from ${user.ward.name}? They're taken out of the ward and all its organizations${p.other_wards ? "" : ", and since they're in no other ward, their account is deleted"}. They could join again with the join code.`}
                      pendingText="Removing…"
                    >
                      Remove from ward
                    </SubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
