import Link from "next/link";
import { publicAppName } from "@/lib/wards";
import { contactEmail } from "@/lib/config";

// The contact address is a server setting (CONTACT_EMAIL), read when the page is shown.
export const dynamic = "force-dynamic";

export const metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  const brand = publicAppName();
  const email = contactEmail();
  return (
    <div className="card prose-eq">
      <h2 className="h2">Terms &amp; Conditions</h2>
      <p>
        These Terms &amp; Conditions apply to the <strong>{brand}</strong> app and its text messaging program. {brand} is an unofficial app run by volunteers for wards and their
        organizations. It is not an official website or app of The Church of Jesus Christ of Latter-day Saints. It is free to use.
      </p>
      <h3>Using the app</h3>
      <ul>
        <li>Join only for yourself, with your own mobile number or email.</li>
        <li>Keep comments and posts kind and appropriate. Leaders review comments and teacher notes before others see them and may remove anything.</li>
        <li>Your ward&apos;s leaders may turn off an account that misuses the app.</li>
      </ul>
      <h3>{brand} text messages (SMS)</h3>
      <ul>
        <li>
          <strong>What you&apos;ll get:</strong> if you give a mobile number, we text you one-time sign-in codes. If you choose texts under More → Contact &amp; notifications, we also text
          lesson reminders (usually twice a week), activity and service reminders, and announcements from your ward and its organizations.
        </li>
        <li>
          <strong>How often:</strong> message frequency varies, typically 2 to 10 messages a month.
        </li>
        <li>
          <strong>Cost:</strong> message and data rates may apply from your mobile carrier. The app never charges you.
        </li>
        <li>
          <strong>Stop anytime:</strong> reply <strong>STOP</strong> to stop texts, or change your choice under More → Contact &amp; notifications. Reply <strong>HELP</strong> for help, or email{" "}
          <a href={`mailto:${email}`}>{email}</a>.
        </li>
        <li>Carriers are not liable for delayed or undelivered messages.</li>
      </ul>
      <h3>Privacy</h3>
      <p>
        See our{" "}
        <Link href="/privacy" className="link">
          Privacy Policy
        </Link>{" "}
        for what the app keeps and how long. Mobile numbers and text consent are never shared with or sold to anyone.
      </p>
      <p>
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
