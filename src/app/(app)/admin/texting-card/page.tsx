import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { joinQrSvg, textingNumberDisplay } from "@/lib/text-join";
import { orgHasNoTexting, phoneEnabled } from "@/lib/sms";

export const metadata = { title: "Texting card" };

/**
 * A card to hand members who'd rather not use the app: after a leader adds them with
 * their mobile number, they text JOIN to the app's number and get everything by text.
 * Four to a page, to cut apart.
 */
export default async function TextingCardPage() {
  const user = await requireAdmin();
  const number = textingNumberDisplay();
  const ready = phoneEnabled() && !!number && !orgHasNoTexting(user.org_id);
  const qr = ready ? await joinQrSvg() : "";
  const card = (i: number) => (
    <div key={i} className="texting-card flex flex-col items-center justify-between gap-1.5 rounded-xl border-2 border-dashed border-border bg-white p-4 text-center text-black">
      <div>
        <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">{user.ward.name}</div>
        <div className="text-2xl font-bold">Ward messages by text</div>
        <div className="text-sm text-gray-700">No app or computer needed.</div>
      </div>
      <div>
        <div className="text-lg">
          Text <strong className="rounded bg-gray-100 px-2 py-0.5 text-xl tracking-wider">JOIN</strong> to
        </div>
        <div className="text-4xl font-bold tracking-wide">{number}</div>
      </div>
      <div className="flex items-center gap-3 text-left">
        <div className="h-20 w-20 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="text-xs text-gray-700">Or point your phone&apos;s camera here to start the text.</div>
      </div>
      <ol className="list-decimal space-y-0.5 pl-5 text-left text-sm leading-snug text-gray-800">
        <li>Make sure your leaders have your mobile number.</li>
        <li>Text JOIN. You&apos;ll get a reply saying you&apos;re signed up.</li>
        <li>Reminders and messages come by text. Reply to any of them to reach your leaders.</li>
      </ol>
      <div className="text-[10px] leading-tight text-gray-600">Text STOP anytime to stop. Msg &amp; data rates may apply. Message frequency varies.</div>
    </div>
  );
  return (
    <div className="print-sheet">
      <div className="no-print mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/members" className="text-sm text-muted hover:text-text">
            ← Members
          </Link>
          <span className="ml-auto" />
          {ready && <PrintButton label="Print cards" />}
        </div>
        <h1 className="h1">Texting card</h1>
        <p className="text-sm text-muted">
          For members who&apos;d rather not use the app. First add them under <strong>Admin → Members → Add a member</strong> with their name and mobile number. Then hand
          them this card: when they text <strong>JOIN</strong>, they&apos;re signed up and get every reminder and message by text, and their texted replies reach
          you. Their page then says &ldquo;Agreed to ward texts … by texting JOIN&rdquo;. Prints four to a page; cut along the dashed lines.
        </p>
      </div>
      {ready ? (
        <div className="texting-cards grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map(card)}</div>
      ) : (
        <p className="card text-sm text-muted">
          {orgHasNoTexting(user.org_id) ? "Your ward uses email, not texts, so there's no texting card." : "Texting isn't set up yet, so there's no number to put on the card."}
        </p>
      )}
    </div>
  );
}
