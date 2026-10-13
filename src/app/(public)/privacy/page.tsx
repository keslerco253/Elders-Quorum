import Link from "next/link";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="card prose-eq">
      <h2 className="h2">What this app keeps</h2>
      <p>This is an unofficial app run by our elders quorum presidency. It is not an official website of The Church of Jesus Christ of Latter-day Saints, and it does not use or copy any Church membership records.</p>
      <h3>What we keep</h3>
      <ul>
        <li>Your name and email, which you enter when you join.</li>
        <li>Things you choose to post: lesson comments, teacher notes, offers to teach, sign-ups, RSVPs and event requests.</li>
        <li>If you turn on notifications, a technical address for your device so it can receive them.</li>
      </ul>
      <h3>What we never keep</h3>
      <ul>
        <li>Addresses, phone numbers, birth dates or any information from Church records.</li>
      </ul>
      <h3>How long we keep it</h3>
      <ul>
        <li>Sign-ups, RSVPs and event requests: deleted 30 days after the event.</li>
        <li>Offers to teach: deleted 30 days after the lesson.</li>
        <li>Lesson comments and teacher notes: deleted 6 months after the lesson.</li>
        <li>Your account: deleted if you don&apos;t sign in for 12 months, or any time you choose.</li>
      </ul>
      <h3>Your choices</h3>
      <p>
        You can delete your account and everything you&apos;ve posted at any time under <strong>More → Delete my account</strong>. Your information is never sold or shared outside the quorum presidency and ward leaders who help run the app.
      </p>
      <p>
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
