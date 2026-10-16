import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgShares, shareQrSvg, shareUrl } from "@/lib/public-shares";
import { formatDateTime } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { CopyButton } from "@/components/copy-button";
import { ShareButton } from "@/components/share-button";
import { stopPublicShare } from "./actions";

export const metadata = { title: "Shared publicly" };

/** Everything this organization shares with a public link, with its QR code and a way to stop. */
export default async function SharedPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const shares = orgShares(user.org_id);
  const qrs = await Promise.all(shares.map((s) => shareQrSvg(s.token)));
  const guests = (signupId: number | null) =>
    signupId
      ? (db().prepare("SELECT COUNT(*) AS n FROM signup_guests g JOIN signup_slots sl ON sl.id = g.slot_id WHERE sl.signup_id = ? AND g.confirmed_at IS NOT NULL").get(signupId) as { n: number }).n
      : 0;
  return (
    <>
      <PageHeader
        title="Shared publicly"
        back={{ href: "/admin", label: "Admin" }}
        subtitle="Links and QR codes anyone can open without an account. Each shows only that one picture, PDF or service opportunity."
      />
      <Flash msg={sp.new ? "The link and QR code are ready. Download the QR code for a poster or bulletin." : sp.msg} tone="success" />
      <p className="mb-4 text-sm text-muted">
        To share something, open it and tap <strong>Share publicly</strong>: a service opportunity (Service), an event&apos;s flyer (Calendar), or a whole plan page or one picture or PDF in it (Plans).
      </p>
      {shares.length === 0 ? (
        <Empty>Nothing is shared publicly.</Empty>
      ) : (
        <ul className="space-y-3">
          {shares.map((s, i) => (
            <li key={s.token} id={s.token} className={`card flex flex-wrap gap-4 scroll-mt-20 ${sp.new === s.token ? "ring-2 ring-accent" : ""}`}>
              <div className="h-32 w-32 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">{s.title || "Untitled"}</span>
                  <Badge tone="info">{s.kind === "signup" ? "Service sign-up" : s.kind === "plan" ? "Whole plan page" : "Picture or PDF"}</Badge>
                </div>
                <div className="break-all font-mono text-xs">{shareUrl(s.token)}</div>
                <div className="text-xs text-muted">
                  Shared{s.created_by_name ? ` by ${s.created_by_name}` : ""} {formatDateTime(s.created_at, user.ward.timezone, "LLL d, yyyy")}
                  {s.kind === "signup" && ` · ${guests(s.signup_id)} signed up without an account`}
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={shareUrl(s.token)} label="Copy link" />
                  <ShareButton url={shareUrl(s.token)} title={s.title || undefined} />
                  <a href={`/admin/shared/${s.token}/qr`} className="btn-secondary btn-sm">
                    Download QR code
                  </a>
                  <Link href={`/p/${s.token}`} target="_blank" className="btn-secondary btn-sm">
                    See what they see
                  </Link>
                  <form action={stopPublicShare}>
                    <input type="hidden" name="token" value={s.token} />
                    <SubmitButton className="btn-danger btn-sm" pendingText="Stopping…" confirm="Stop sharing? The link and QR code stop working right away.">
                      Stop sharing
                    </SubmitButton>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
