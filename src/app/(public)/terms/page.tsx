import Link from "next/link";
import { publicAppName } from "@/lib/wards";

export const metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  const brand = publicAppName();
  return (
    <div className="card prose-eq">
      <h2 className="h2">Terms &amp; Conditions</h2>
      <p>
        These Terms &amp; Conditions apply to the <strong>{brand}</strong> app and its text messaging program. {brand} is an unofficial app run by volunteers in our elders
        quorum presidency for quorum members. It is not an official website of The Church of Jesus Christ of Latter-day Saints. It is free to use.
      </p>
      <h3>Using the app</h3>
      <ul>
        <li>Join only for yourself, with your own mobile number or email.</li>
        <li>Keep comments and posts kind and appropriate. The presidency reviews comments and teacher notes before others see them and may remove anything.</li>
        <li>The presidency may turn off an account that misuses the app.</li>
      </ul>
      <h3>{brand} text messages (SMS)</h3>
      <ul>
        <li>
          <strong>What you&apos;ll get:</strong> if you give a mobile number, we text you one-time sign-in codes. If you choose texts under More → My contact info, we also text
          lesson reminders (usually twice a week), activity reminders and quorum announcements.
        </li>
        <li>
          <strong>How often:</strong> message frequency varies, typically 2 to 10 messages a month.
        </li>
        <li>
          <strong>Cost:</strong> message and data rates may apply from your mobile carrier. The quorum never charges you.
        </li>
        <li>
          <strong>Stop anytime:</strong> reply <strong>STOP</strong> to stop texts, or change your choice under More → My contact info. Reply <strong>HELP</strong> for help, or contact
          the elders quorum presidency at villaseldersquorum@gmail.com.
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
