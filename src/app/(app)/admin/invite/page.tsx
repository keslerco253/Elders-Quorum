import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { isPresidency } from "@/lib/permissions";
import { appUrl } from "@/lib/config";
import { joinLink, joinQrSvg } from "@/lib/invite";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { ShareInvite } from "@/components/share-invite";
import { setJoinCode } from "../settings/actions";

export const metadata = { title: "Invite members" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const code = user.ward.join_code;
  const presidency = isPresidency(user);

  return (
    <>
      <PageHeader title="Invite members" back={{ href: "/admin", label: "Admin" }} subtitle="Use this in a ward meeting or class: everyone scans the code with their phone camera and joins in about a minute." />
      <Flash msg={sp.msg} />
      {!code ? (
        <Empty>
          <p className="mb-3">There&apos;s no join code yet.</p>
          {presidency ? (
            <form action={setJoinCode}>
              <input type="hidden" name="return" value="/admin/invite" />
              <SubmitButton name="mode" value="new">
                Create a join code
              </SubmitButton>
            </form>
          ) : (
            <p>Ask a presidency member to create one.</p>
          )}
        </Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-[320px_1fr]">
          <div className="card flex flex-col items-center gap-3">
            <div className="w-full max-w-[280px] rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: await joinQrSvg(code) }} />
            <div className="text-center">
              <div className="text-xs tracking-wide text-muted uppercase">Join code</div>
              <div className="font-mono text-3xl font-bold tracking-[0.2em]">{code}</div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card space-y-3">
              <h2 className="h2">In a meeting</h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>
                  Tap <strong>Show on a big screen</strong> and put it on the TV or projector, or just hold up your phone.
                </li>
                <li>Members open their phone camera and point it at the code, then tap the link.</li>
                <li>They type their name and email (the code is already filled in) and tap Join.</li>
                <li>They enter the 6-digit code from their email, and they&apos;re in.</li>
              </ol>
              <Link href="/present/invite" className="btn-primary" target="_blank">
                Show on a big screen
              </Link>
            </div>
            <div className="card space-y-3">
              <h2 className="h2">Send it to the ward</h2>
              <p className="text-sm text-muted">Share the link in a group text, an email, or the ward newsletter. Anyone with the link can join, so keep it within the ward.</p>
              <p className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm break-all">{joinLink(code)}</p>
              <ShareInvite text={`Join the ${user.ward.name} app for reminders, sign-ups and ward news. Join code: ${code}`} link={joinLink(code)} />
            </div>
            {presidency && (
              <form action={setJoinCode} className="card space-y-2 text-sm">
                <input type="hidden" name="return" value="/admin/invite" />
                <p className="text-muted">If the code gets shared outside the ward, make a new one. The old code and QR code stop working.</p>
                <SubmitButton name="mode" value="new" className="btn-secondary btn-sm" confirm="Make a new code? The current code and QR code will stop working.">
                  Make a new code
                </SubmitButton>
              </form>
            )}
            <p className="text-xs text-muted">App address: {appUrl()}</p>
          </div>
        </div>
      )}
    </>
  );
}
