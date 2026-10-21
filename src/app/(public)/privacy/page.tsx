import Link from "next/link";
import { publicAppName } from "@/lib/wards";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const brand = publicAppName();
  return (
    <div className="card prose-eq">
      <h2 className="h2">Privacy Policy</h2>
      <p>
        This Privacy Policy explains how <strong>{brand}</strong> handles information in our app. {brand} is an unofficial app run by volunteers in our elders quorum
        presidency. It is not an official website of The Church of Jesus Christ of Latter-day Saints, and it does not use or copy any Church membership records.
      </p>
      <h3>Information we collect</h3>
      <ul>
        <li>Your name, and the mobile number and/or email you choose to give when you join. You can add, change or remove them anytime under More → Contact &amp; notifications.</li>
        <li>Things you choose to post: lesson comments, teacher notes, offers to teach, sign-ups, RSVPs, event requests, visit requests, and messages you send the presidency (in the app or by texting back). Visit requests and messages to the presidency are seen only by the elders quorum presidency.</li>
        <li>
          Presidency planning: the presidency&apos;s meeting notes and agenda, and assignments they give (with progress notes from them and the person assigned). Meeting
          notes and the agenda are seen only by the presidency; you see assignments given to you and their notes, except notes the presidency keeps to itself.
        </li>
        <li>If you turn on notifications, a technical address for your device so it can receive them.</li>
        <li>
          If you sign up for a service project from a shared link without an account: your name, the mobile number or email you give, and an optional note. Only the organizers see them. We
          text you only if you tick the box agreeing to texts (we keep when you agreed and the words you agreed to); reply STOP anytime.
        </li>
      </ul>
      <p>We never collect addresses, birth dates or any information from Church records.</p>
      <h3>How we use it</h3>
      <p>
        Only to run the app: to sign you in, to show your posts to the quorum, and to send the sign-in codes, reminders and quorum messages you choose to receive by text,
        email or notification.
      </p>
      <h3>Text messages (SMS)</h3>
      <p>
        If you give a mobile number, {brand} texts you one-time sign-in codes and, if you choose, quorum reminders and messages. Message frequency varies. Message and data
        rates may apply. Reply <strong>STOP</strong> to opt out or <strong>HELP</strong> for help.
      </p>
      <p>
        <strong>
          No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All the above categories exclude text messaging
          originator opt-in data and consent; this information will not be shared with any third parties.
        </strong>
      </p>
      <h3>Sharing</h3>
      <p>
        We do not sell, rent or share your personal information with anyone. Only the quorum leaders who run the app can see members&apos; contact information. Our text and
        email providers process messages only to deliver them.
      </p>
      <h3>How long we keep it</h3>
      <ul>
        <li>Sign-ups, RSVPs and event requests: deleted 30 days after the event (including sign-ups from a shared link without an account).</li>
        <li>Offers to teach: deleted 30 days after the lesson.</li>
        <li>Lesson comments and teacher notes: deleted 6 months after the lesson.</li>
        <li>Messages between you and the presidency: deleted after 6 months.</li>
        <li>Visit requests: deleted 30 days after they&apos;re finished or cancelled, and never kept more than 6 months.</li>
        <li>
          Presidency meeting notes, agenda items and finished assignments: reviewed 3 months after the meeting (or after the assignment is done), and every 3 months after
          that, and deleted once they&apos;re no longer needed.
        </li>
        <li>Your account: deleted if you don&apos;t sign in for 12 months, or any time you choose.</li>
      </ul>
      <h3>Your choices</h3>
      <p>
        You can delete your account and everything you&apos;ve posted at any time under <strong>More → Delete my account</strong>, or ask the elders quorum presidency to do
        it. Questions: email villaseldersquorum@gmail.com.
      </p>
      <p>
        <Link href="/terms" className="link">
          Terms &amp; Conditions
        </Link>{" "}
        ·{" "}
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
