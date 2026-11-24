# App Review: answers for Apple

What we send Apple when App Review asks for more information (Guideline 2.1:
recording, purpose, setup, services, regions, authorization). Two versions:

- **Reply** (App Store Connect → the app → App Review → the message → Reply):
  the full answers, with the screen recording attached (or a link to it).
- **Notes** (App Store Connect → the version → App Review Information → Notes):
  the same, shorter. The Notes box holds 4,000 characters; this version is about
  3,000.

Replace `[EMAIL]` and `[CODE]` with the demo account (Northflank `REVIEW_LOGIN`,
see MOBILE-APP.md → App review) and `[LINK]` with the recording's link. Make sure
`REVIEW_LOGIN` is set on Northflank before replying, and leave it until the app is
approved.

---

## Reply (paste into the App Review message)

Hello, and thank you for reviewing My Ward Link. Here is the information you asked for.

**1. Screen recording**
The recording is attached [or: is at [LINK]]. It was made on a physical iPhone running the latest iOS, starting from launching the app, and shows:
- Account registration: joining a ward with its join code, entering a name and email, and the sign-in code.
- Sign-in with a one-time code (the app has no passwords) and signing out.
- Account deletion: More → Delete my account → confirm. The account and its data are deleted at once.
- User-generated content: posting a lesson comment, tapping Report on a comment (hidden for the reporter at once; the ward's leaders are notified), Block (that person's comments are hidden; More → Blocked people → Unblock), and a leader's review of reported comments.
- The typical flow: Home, Lessons, the Calendar and an event, Service sign-ups, Messages, notifications, and Face ID lock.
The app has no paid content, subscriptions or in-app purchases.

**2. Purpose and audience**
My Ward Link is a free app for members and volunteer leaders of a local congregation ("ward") of The Church of Jesus Christ of Latter-day Saints. Ward leaders otherwise coordinate by scattered group texts, emails and paper sign-up sheets, and members miss lessons, events and service requests. The app puts each ward's lesson schedule, calendar, service sign-ups and messages with their leaders in one private place, with reminders by push notification, email or text. It is run by volunteers, has no ads, and is not affiliated with or endorsed by the Church; it says so on every screen.

**3. How to access it**
- Demo account: on the sign-in screen enter [EMAIL] and tap the button under it (nothing is actually sent), then enter the code [CODE]. It opens "Maple Grove Ward (Demo)", made-up people and content only.
- Main features: Home (what's coming up), Lessons (this Sunday's lesson and comments), Calendar (events; tap one to add it to the phone's calendar), Service (sign up for a time), Messages (write to the ward's leaders), More → Notifications (turn on push notifications), More → Privacy (lock with Face ID), More → Delete my account.
- No sample files are needed.

**4. External services**
- Hosting: Northflank (our server and database).
- Sign-in: our own one-time codes sent by email (our own Gmail account, over SMTP) or by text message (Twilio). No third-party sign-in.
- Notifications: Apple Push Notification service, through Expo's push service; web push for the website.
- Text messages: Twilio.
- Email: Gmail (SMTP).
- AI: Anthropic's Claude API, for two optional features: answering leaders' questions about how to use the app, and turning a spoken or typed sentence into a calendar event ("Say an event"), which the user checks before it's added.
- Content links: lesson and reading links open public pages on churchofjesuschrist.org. Map and calendar links open Google Maps and Google Calendar.
- No payment processors, advertising networks or analytics services.

**5. Regions**
The app works the same in every region where it's offered. It's in English. Text messages go only to US and Canadian phone numbers (a US texting number); elsewhere members get the same reminders by push notification or email.

**6. Regulation and third-party material**
The app isn't in a regulated industry (no health, financial, legal or government services). It doesn't reproduce copyrighted material: it links to the Church's public website for lesson materials and shows only titles and reading references. It uses the Church's name only to say who the app is for, and states on every screen that it is "an independent app run by volunteers… not an official website or app of The Church of Jesus Christ of Latter-day Saints, and is not affiliated with or endorsed by the Church." Each ward's content is added by that ward's own leaders and members.

Thank you!

---

## Notes (paste into App Review Information → Notes)

My Ward Link: a free app for members and volunteer leaders of a local congregation ("ward") of The Church of Jesus Christ of Latter-day Saints. It puts the ward's lesson schedule, calendar, service sign-ups and messages with leaders in one private place, with reminders by push, email or text. Run by volunteers, no ads, no purchases; not affiliated with or endorsed by the Church (stated on every screen).

DEMO ACCOUNT: on the sign-in screen enter [EMAIL], tap the button under it (nothing is actually sent), then enter the code [CODE]. It opens "Maple Grove Ward (Demo)": made-up people and content only.

TO TRY: Home; Lessons (this Sunday's lesson, comments); Calendar (tap an event, add it to the phone's calendar); Service (sign up); Messages; More → Notifications (push); More → Privacy (Face ID lock); More → Delete my account. Native: tab bar with badges, push notifications that open the right screen, app icon badge, Face ID lock, share sheet, home-screen widget.

ACCOUNTS: register by joining a ward with its join code (name, email or phone, one-time code). No passwords: sign-in is a one-time code by email or text. Account deletion: More → Delete my account (immediate).

USER CONTENT: lesson comments and messages stay within the member's own ward. Comments wait for a leader's approval; any member can Report a comment (hidden for them at once, leaders notified) or Block its author (More → Blocked people to unblock). Terms (mywardlink.net/terms): no tolerance for objectionable content or abusive users.

SERVICES: Northflank (hosting); Gmail SMTP (email); Twilio (text messages); Apple Push Notification service via Expo; Anthropic Claude API (optional: leaders' how-to questions, and turning a spoken sentence into a calendar event the user checks first). Links open churchofjesuschrist.org, Google Maps, Google Calendar. No payments, ads or analytics.

REGIONS: works the same in all regions; English. Texts go only to US/Canadian numbers; elsewhere the same reminders come by push or email.

REGULATION / THIRD-PARTY MATERIAL: not a regulated industry. No copyrighted material reproduced: lesson materials are links to the Church's public site (titles and reading references only). The Church's name is used only to say who the app is for, with the "not affiliated" notice on every screen.
