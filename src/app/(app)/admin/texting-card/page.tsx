import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { joinQrSvg, joinText, textingNumberDisplay } from "@/lib/text-join";
import { orgHasNoTexting, phoneEnabled } from "@/lib/sms";

export const metadata = { title: "Texting card" };

/**
 * A card to hand members who'd rather not use the app: they text JOIN and the ward's
 * join code to the app's number (someone not added yet then answers a few questions by
 * text: their name and organizations) and get everything by text. Four to a page.
 */
export default async function TextingCardPage() {
  const user = await requireAdmin();
  const number = textingNumberDisplay();
  const ready = phoneEnabled() && !!number && !orgHasNoTexting(user.org_id);
  // New people can join by text when the ward's texting is on; otherwise a leader adds them first.
  const selfJoin = !!user.ward.texting_enabled && !user.ward.pending;
  const text = joinText(selfJoin ? user.ward.join_code : null);
  const qr = ready ? await joinQrSvg(text) : "";
  const card = (i: number) => (
    <div key={i} className="texting-card flex flex-col items-center justify-between gap-1.5 rounded-xl border-2 border-dashed border-border bg-white p-4 text-center text-black">
      <div>
        <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">{user.ward.name}</div>
        <div className="text-2xl font-bold">Ward messages by text</div>
        <div className="text-sm text-gray-700">No app or computer needed.</div>
      </div>
      <div>
        <div className="text-lg">
          Text <strong className="rounded bg-gray-100 px-2 py-0.5 text-xl tracking-wider">{text}</strong> to
        </div>
        <div className="text-4xl font-bold tracking-wide">{number}</div>
      </div>
      <div className="flex items-center gap-3 text-left">
        <div className="h-20 w-20 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="text-xs text-gray-700">Or point your phone&apos;s camera here to start the text.</div>
      </div>
      {selfJoin ? (
        <ol className="list-decimal space-y-0.5 pl-5 text-left text-sm leading-snug text-gray-800">
          <li>Text {text} to the number above.</li>
          <li>If you&apos;re new, it asks your name, then which organizations you&apos;re in: reply with their numbers (like 1 or 1 3).</li>
          <li>You&apos;ll get a reply saying you&apos;re signed up. Reminders and messages come by text; reply to any of them to reach your leaders.</li>
        </ol>
      ) : (
        <ol className="list-decimal space-y-0.5 pl-5 text-left text-sm leading-snug text-gray-800">
          <li>Make sure your leaders have your mobile number.</li>
          <li>Text JOIN. You&apos;ll get a reply saying you&apos;re signed up.</li>
          <li>Reminders and messages come by text. Reply to any of them to reach your leaders.</li>
        </ol>
      )}
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
        {selfJoin ? (
          <p className="text-sm text-muted">
            For members who&apos;d rather not use the app. They text <strong>{text}</strong> (your ward&apos;s join code tells the app which ward). Someone you&apos;ve
            already added with their mobile number is signed up right away. Someone new is asked by text for their name and which organizations they&apos;re in,
            then their account is made and they show under <strong>Ward settings → New members</strong> to check. Either way they get every reminder and message by
            text, and their texted replies reach you. If you make a new join code, print new cards. Prints four to a page; cut along the dashed lines.
          </p>
        ) : (
          <p className="text-sm text-muted">
            For members who&apos;d rather not use the app. First add them under <strong>Admin → Members → Add a member</strong> with their name and mobile number
            (texting isn&apos;t turned on for your ward, so new people can&apos;t join by text on their own). Then hand them this card: when they text{" "}
            <strong>JOIN</strong>, they&apos;re signed up and get every reminder and message by text, and their texted replies reach you. Prints four to a page; cut
            along the dashed lines.
          </p>
        )}
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
