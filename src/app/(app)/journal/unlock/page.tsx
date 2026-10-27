import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { journalAccess } from "@/lib/journal-session";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { eraseJournalAction } from "../actions";
import { UnlockPageForm } from "./unlock-page-form";

export const metadata = { title: "Open my journal" };

export default async function JournalUnlockPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/journal") && !sp.next.startsWith("//") ? sp.next : "/journal";
  if (await journalAccess(user.id)) redirect(next);
  return (
    <>
      <PageHeader title="My Journal" back={{ href: "/more", label: "More" }} />
      <Flash msg={sp.msg} tone="danger" />
      <div className="card mx-auto max-w-sm space-y-3">
        <div className="text-center text-3xl" aria-hidden>
          🔒
        </div>
        <p className="text-center text-sm text-muted">Your journal is locked. Enter your journal passcode to open it.</p>
        <UnlockPageForm next={next} />
        <p className="hint text-center">It locks again after 30 minutes without using it.</p>
      </div>
      <details className="mx-auto mt-6 max-w-sm text-sm">
        <summary className="cursor-pointer text-muted">Forgot your passcode?</summary>
        <div className="card mt-2 space-y-3">
          <p>
            Your passcode isn&apos;t kept anywhere, so no one (not your leaders or the site owner) can open your journal or reset it. If you can&apos;t remember it, the
            only way back is to <strong>erase your journal</strong> and start a new one. Everything in it is deleted for good.
          </p>
          <form action={eraseJournalAction} className="space-y-2">
            <input name="confirm" placeholder="Type DELETE to erase it" className="input" autoComplete="off" aria-label="Type DELETE to erase your journal" />
            <SubmitButton className="btn-danger btn-sm" confirm="Erase your whole journal for good?" pendingText="Erasing…">
              Erase my journal and start over
            </SubmitButton>
          </form>
        </div>
      </details>
    </>
  );
}
