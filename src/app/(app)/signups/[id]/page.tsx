import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { getSignup } from "@/lib/signups";
import { formatDate } from "@/lib/time";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { ShareButton } from "@/components/share-button";
import { appUrl } from "@/lib/config";
import { SubmitButton } from "@/components/client";
import { FlyerView } from "@/components/flyer-view";
import { leaveSlot, removeGuestEntry, takeSlot } from "../actions";
import { confirmedGuests, guestShortName } from "@/lib/guest-signups";
import { formatPhone } from "@/lib/contact";

export const metadata = { title: "Service opportunity" };

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requireUser();
  const s = getSignup(user.org_id, Number((await params).id));
  if (!s) notFound();
  const sp = await searchParams;
  const admin = isAdmin(user);
  // People without an account who signed up from a public link.
  const guests = confirmedGuests(s.id);
  return (
    <>
      <PageHeader
        title={s.title}
        back={{ href: "/signups", label: "Service" }}
        subtitle={s.date ? formatDate(s.date) : undefined}
        actions={
          <>
            <ShareButton
              className="btn-secondary"
              url={`${appUrl()}/signups/${s.id}?org=${s.org_id}`}
              title={s.title}
              text={`Can you help? ${s.title}`}
            />
            {isAdmin(user) && (
              <>
                <Link
                  href={`/admin/shared/new?signup=${s.id}`}
                  className="btn-secondary"
                >
                  Share publicly
                </Link>
                <Link href={`/admin/signups/${s.id}`} className="btn-secondary">
                  Edit
                </Link>
              </>
            )}
          </>
        }
      />
      <Flash msg={sp.msg} />
      {!!s.closed && (
        <p className="mb-4 rounded-lg bg-surface-2 px-4 py-3 text-sm">
          Signing up for this is closed.
        </p>
      )}
      {s.description && (
        <p className="card mb-4 whitespace-pre-wrap">{s.description}</p>
      )}
      {s.flyer_file && <FlyerView file={s.flyer_file} name={s.flyer_name} />}
      <ul className="space-y-3">
        {s.slots.map((sl) => {
          const mine = sl.entries.some((e) => e.member_id === user.id);
          const slotGuests = guests.filter((g) => g.slot_id === sl.id);
          const taken = sl.entries.length + slotGuests.length;
          const full = taken >= sl.capacity;
          return (
            <li key={sl.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{sl.label}</div>
                <Badge tone={full ? "success" : "info"}>
                  {taken} of {sl.capacity}
                  {full ? " · full" : ""}
                </Badge>
              </div>
              {slotGuests.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {slotGuests.map((g) => (
                    <li
                      key={`g${g.id}`}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        <Badge>Guest</Badge>{" "}
                        {admin ? g.name : guestShortName(g.name)}
                        {admin && (
                          <span className="text-muted">
                            {" "}
                            ·{" "}
                            {g.contact_kind === "phone"
                              ? formatPhone(g.contact)
                              : g.contact}
                          </span>
                        )}
                        {g.note && (
                          <span className="text-muted"> · {g.note}</span>
                        )}
                      </span>
                      {admin && (
                        <form action={removeGuestEntry}>
                          <input type="hidden" name="guest_id" value={g.id} />
                          <input type="hidden" name="signup_id" value={s.id} />
                          <SubmitButton
                            className="btn-secondary btn-sm"
                            pendingText="Removing…"
                            confirm={`Remove ${g.name}?`}
                          >
                            ✕ Remove
                          </SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {sl.entries.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {sl.entries.map((e) => (
                    <li
                      key={e.member_id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        {e.display_name}
                        {e.member_id === user.id && (
                          <span className="text-muted"> (you)</span>
                        )}
                        {e.note && (
                          <span className="text-muted"> · {e.note}</span>
                        )}
                      </span>
                      {(e.member_id === user.id || admin) && (
                        <form action={leaveSlot}>
                          <input type="hidden" name="slot_id" value={sl.id} />
                          {e.member_id !== user.id && (
                            <input
                              type="hidden"
                              name="member_id"
                              value={e.member_id}
                            />
                          )}
                          <SubmitButton
                            className="btn-secondary btn-sm"
                            pendingText="Removing…"
                            confirm={
                              e.member_id === user.id
                                ? "Remove yourself from this spot?"
                                : `Remove ${e.display_name}?`
                            }
                          >
                            ✕ Remove
                          </SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!s.closed &&
                (mine ? (
                  <p className="mt-3 text-sm text-success">
                    ✓ You&apos;re signed up for this. Use ✕ Remove next to your
                    name to cancel.
                  </p>
                ) : (
                  !full && (
                    <form
                      action={takeSlot}
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      <input type="hidden" name="slot_id" value={sl.id} />
                      <input
                        name="note"
                        maxLength={200}
                        placeholder="Note (optional)"
                        className="input max-w-xs flex-1"
                      />
                      <SubmitButton className="btn-primary btn-sm">
                        Sign me up
                      </SubmitButton>
                    </form>
                  )
                ))}
            </li>
          );
        })}
      </ul>
    </>
  );
}
