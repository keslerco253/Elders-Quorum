import Link from "next/link";
import { publicAppName } from "@/lib/wards";
import { contactEmail } from "@/lib/config";

// The contact address is a server setting (CONTACT_EMAIL), read when the page is shown.
export const dynamic = "force-dynamic";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const brand = publicAppName();
  const email = contactEmail();
  return (
    <div className="card prose-eq">
      <h2 className="h2">Privacy Policy</h2>
      <p>
        This Privacy Policy explains how <strong>{brand}</strong> handles information. {brand} is an unofficial app run by volunteers for wards and their organizations
        (such as the elders quorum, Relief Society, youth, Primary and Sunday School). It is not an official website or app of The Church of Jesus Christ of Latter-day
        Saints, and it does not use or copy any Church membership records.
      </p>
      <h3>Information we collect</h3>
      <ul>
        <li>Your name, and the mobile number and/or email you choose to give when you join. You can add, change or remove them anytime under More → Contact &amp; notifications.</li>
        <li>Which of your ward&apos;s organizations you choose to belong to and get notifications from.</li>
        <li>
          Things you choose to post: lesson comments, teacher notes, offers to teach, sign-ups, RSVPs, event requests, visit requests, and messages you send your leaders (in
          the app or by texting back). Visit requests and messages to leaders are seen only by the leaders you send them to (an organization&apos;s presidency, the
          bishopric, or one leader if you write privately).
        </li>
        <li>
          Leaders&apos; planning: an organization&apos;s presidency (or the bishopric) keeps meeting notes, an agenda, home visit records, and assignments they give (with
          progress notes from them and the person assigned). These are seen only by that presidency; you see assignments given to you and their notes, except notes the
          presidency keeps to itself.
        </li>
        <li>Your own to-dos under My assignments: only you can see them.</li>
        <li>
          Your journal (More → My Journal): only you can see it. No leader or site owner page shows it, and what you write is stored encrypted.
        </li>
        <li>What you log in a challenge (e.g. temple work): only you see your entries; everyone else sees team totals only.</li>
        <li>Whether each notification reached you (by app, email or text) and whether you opened it, so leaders know who didn&apos;t get something.</li>
        <li>If you turn on notifications, a technical address for your device so it can receive them.</li>
        <li>
          If you sign up for a service project from a shared link without an account: your name, the mobile number or email you give, and an optional note. Only the
          organizers see them. We text you only if you tick the box agreeing to texts (we keep when you agreed and the words you agreed to); reply STOP anytime.
        </li>
      </ul>
      <p>We never collect addresses, birth dates or any information from Church records.</p>
      <h3>How we use it</h3>
      <p>
        Only to run the app: to sign you in, to show your posts to your ward or organization, and to send the sign-in codes, reminders and messages you choose to receive
        by text, email or notification.
      </p>
      <h3>Text messages (SMS)</h3>
      <p>
        If you give a mobile number, {brand} texts you one-time sign-in codes and, if you choose, reminders and messages from your ward and its organizations. Message
        frequency varies. Message and data rates may apply. Reply <strong>STOP</strong> to opt out or <strong>HELP</strong> for help.
      </p>
      <p>
        <strong>
          No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All the above categories exclude text messaging
          originator opt-in data and consent; this information will not be shared with any third parties.
        </strong>
      </p>
      <h3>Sharing</h3>
      <p>
        We do not sell, rent or share your personal information with anyone. Only your ward&apos;s and organizations&apos; leaders can see members&apos; contact
        information. Our text and email providers process messages only to deliver them. When a leader asks the leader guide a question, only the question they type (and
        the guide itself, never anyone&apos;s information) is sent to Anthropic&apos;s Claude to write the answer.
      </p>
      <h3>How long we keep it</h3>
      <ul>
        <li>Service opportunities and their sign-ups (including sign-ups from a shared link without an account): deleted 30 days after the date.</li>
        <li>RSVPs and event requests: deleted 30 days after the event.</li>
        <li>Offers to teach and answers to &ldquo;Will you teach?&rdquo;: deleted 30 days after the lesson.</li>
        <li>Lesson comments and teacher notes: deleted 6 months after the lesson.</li>
        <li>Messages between you and your leaders: deleted after 6 months. Announcements: after 1 year.</li>
        <li>Reminders and alerts sent to you, and whether they reached you: deleted after 30 days.</li>
        <li>Visit requests: deleted 30 days after they&apos;re finished or cancelled, and never kept more than 6 months.</li>
        <li>
          Meeting notes, agenda items and finished assignments: reviewed by the presidency 3 months after the meeting (or after the assignment is done), and every 3
          months after that, and deleted once they&apos;re no longer needed.
        </li>
        <li>Your own to-dos: deleted 6 months after you mark them done, or any time you delete them.</li>
        <li>Your journal: kept until you delete entries or your account (download it first to keep a copy).</li>
        <li>Challenge entries: no longer tied to you 30 days after the challenge ends (only the team totals stay).</li>
        <li>Your account: deleted if you don&apos;t sign in for 12 months, or any time you choose.</li>
      </ul>
      <h3>Your choices</h3>
      <p>
        You can delete your account and everything you&apos;ve posted at any time under <strong>More → Delete my account</strong>, on the{" "}
        <Link href="/delete-account" className="link">
          Delete your account
        </Link>{" "}
        page (no app needed), or ask your ward&apos;s leaders to remove you. You can choose which organizations you hear from under More → My organizations, and how you&apos;re reached under More → Contact &amp; notifications.
        Questions: email <a href={`mailto:${email}`}>{email}</a>.
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
