import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { appUrl } from "@/lib/config";
import { joinLink, joinQrSvg } from "@/lib/invite";
import { joinQrSvg as textQrSvg, joinText, textingNumberDisplay } from "@/lib/text-join";
import { orgHasNoTexting, phoneEnabled } from "@/lib/sms";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "App flyer" };

/**
 * A half-page flyer for the app, two to a letter page: a QR code to join (or sign in),
 * how to put the app on the home screen and turn on notifications, and (where the ward
 * texts) how to get everything by text instead.
 */
export default async function AppFlyerPage() {
  const user = await requireUser();
  if (!isAdmin(user) && !user.wardAdmin) redirect("/");
  const code = user.ward.join_code;
  if (!code) redirect("/admin/invite");
  const qr = await joinQrSvg(code);
  const site = appUrl().replace(/^https?:\/\//, "");
  // Texts too, where the ward has texting (new people can join by text when it's on).
  const number = textingNumberDisplay();
  const texts = phoneEnabled() && !!number && !orgHasNoTexting(user.org_id);
  const text = joinText(user.ward.texting_enabled && !user.ward.pending ? code : null);
  const textQr = texts ? await textQrSvg(text) : "";

  const flyer = (i: number) => (
    <section key={i} className="app-flyer flex flex-col gap-3 rounded-xl border-2 border-dashed border-border bg-white p-5 text-black">
      <div className="text-center">
        <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">{user.ward.name}</div>
        <h2 className="text-2xl leading-tight font-bold">Get ward reminders and news on your phone</h2>
        <p className="text-sm text-gray-700">Lessons, the calendar, sign-ups and messages from your leaders, all in one place.</p>
      </div>
      <div className="flex flex-1 gap-4">
        <div className="flex w-[36%] shrink-0 flex-col items-center text-center">
          <div className="text-sm font-bold">1. Scan to join or sign in</div>
          <div className="mt-1 aspect-square w-full max-w-[1.9in] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="mt-1 text-[11px] leading-snug text-gray-700">
            Or go to <strong>{site}/join</strong>
            <br />
            Join code: <strong className="tracking-wider">{code}</strong>
          </div>
        </div>
        <div className="space-y-2 text-[12.5px] leading-snug">
          <div>
            <div className="font-bold">New here?</div>
            Enter your name and your phone number or email, then the 6-digit code we send you. <strong>Have an account?</strong> Tap Sign in instead.
          </div>
          <div>
            <div className="font-bold">2. Put it on your home screen</div>
            <div>
              <strong>iPhone:</strong> open it in <strong>Safari</strong>, tap Share <span aria-hidden>(□↑)</span>, then <strong>Add to Home Screen</strong>.
            </div>
            <div>
              <strong>Android:</strong> in <strong>Chrome</strong>, tap ⋮, then <strong>Install app</strong> (or Add to Home screen).
            </div>
          </div>
          <div>
            <div className="font-bold">3. Turn on notifications</div>
            Open <strong>My Ward Link</strong> from the new icon, tap <strong>More</strong>, then <strong>Turn on notifications</strong>. (On iPhone, notifications only work from the home screen icon.)
          </div>
        </div>
      </div>
      {texts && (
        <div className="flex items-center gap-3 rounded-lg bg-gray-100 px-3 py-2">
          <div className="h-[0.75in] w-[0.75in] shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: textQr }} />
          <div className="text-[12px] leading-snug">
            <strong>Prefer texts? No app needed.</strong> Text <strong className="tracking-wider">{text}</strong> to <strong>{number}</strong>. Text STOP anytime to stop. Msg &amp;
            data rates may apply.
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div className="print-sheet">
      <div className="no-print mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/invite" className="text-sm text-muted hover:text-text">
            ← Invite members
          </Link>
          <span className="ml-auto" />
          <PrintButton label="Print flyers" />
        </div>
        <h1 className="h1">App flyer</h1>
        <p className="text-sm text-muted">
          Two half-page flyers to a letter page; cut along the dashed lines. The QR code opens the join page with your ward&apos;s code filled in (someone who already has an
          account signs in from there). If you make a new join code, print new flyers.
        </p>
      </div>
      <div className="app-flyers grid gap-4">{[0, 1].map(flyer)}</div>
    </div>
  );
}
