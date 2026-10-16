# The My Ward Link phone app (iPhone and Android)

The phone app lives in `mobile/`. It's a React Native (Expo) app that shows
the web app (mywardlink.net) and adds what a website can't do well on phones:

- **Real push notifications** on iPhone and Android, with no "Add to Home
  Screen" step. They go through Expo's push service, which delivers through
  Apple and Google.
- **Links open in the app**: sign-in emails, texts, and anything on mywardlink.net.
- Text, phone, map and calendar links open in the phone's own apps. Other
  websites open in an in-app browser.
- The Android back button, pull to refresh, a "can't connect" screen, and the
  app icon and splash screen.

Everything else is the web app, so **changes you push to `main` show up in the
app right away**, without a new App Store release. A new app release is only
needed when `mobile/` changes.

Builds run in Expo's cloud (**EAS**), so **no Mac is needed**. You can run
everything below from your Windows PC or straight from GitHub.

---

## One-time setup (about an hour, plus waiting on Apple and Google)

You'll need: your Apple Developer and Google Play accounts, a free Expo
account, a free Firebase account (Google), and Node.js on your PC
(https://nodejs.org, LTS).

### 1. Expo account and project

1. Sign up at https://expo.dev (free).
2. On your PC, open PowerShell in the `Elders-Quorum\mobile` folder (a copy
   from GitHub: `git clone https://github.com/keslerco253/elders-quorum`):
   ```
   npm install
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
3. `init` prints a **project ID** (a long code like `1a2b3c4d-…`). Send it to
   Claude to add to `mobile/app.config.js`, or add it yourself in the
   `eas: { projectId: … }` line, and push.

### 2. Apple: app record and signing

1. In https://appstoreconnect.apple.com → **Apps → +** → New App:
   - Platform iOS, name **My Ward Link**, language English (U.S.).
   - Bundle ID: **net.mywardlink.app** (register it first if asked:
     developer.apple.com → Identifiers → +, App IDs, with **Push Notifications**
     and **Associated Domains** ticked).
   - SKU: `mywardlink`.
2. In PowerShell (in `mobile`), run a first iPhone build:
   ```
   npx eas-cli@latest build --platform ios --profile production
   ```
   Sign in with your Apple ID when asked. Answer **yes** to letting EAS create
   the distribution certificate, provisioning profile and **push notification
   key**. EAS keeps them for every later build.
3. Your **Team ID** is on developer.apple.com → Membership details. Add it on
   Northflank as the environment variable `APPLE_TEAM_ID` (for links that open
   the app, and so texted sign-in codes fill in by themselves in the app). Check
   https://mywardlink.net/.well-known/apple-app-site-association shows your
   Team ID; if it says "Not found", the variable isn't set.

### 3. Google: Firebase (Android notifications) and the Play listing

1. https://console.firebase.google.com → **Add project** ("My Ward Link",
   Analytics off).
2. In the project: **Add app → Android**, package name **net.mywardlink.app**.
   Download **google-services.json** and put it in the `mobile` folder (it's
   safe to commit).
3. Project settings → **Service accounts → Generate new private key**. This
   downloads a JSON key. It is a secret: don't commit or share it. Then:
   ```
   npx eas-cli@latest credentials
   ```
   Choose Android → production → **Google Service Account → FCM V1** → upload
   that file. Then delete the file from your PC.
4. In https://play.google.com/console → **Create app**: "My Ward Link", app,
   free. Fill in the store listing (below) and the app content questionnaire.
5. First Android build:
   ```
   npx eas-cli@latest build --platform android --profile production
   ```
6. Play Console → **App integrity** shows the **SHA-256 certificate
   fingerprint** of the app signing key. Add it on Northflank as
   `ANDROID_CERT_SHA256` (for links that open the app).

### 4. Northflank settings for the app

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | from step 2.3 |
| `ANDROID_CERT_SHA256` | from step 3.6 |
| `REVIEW_LOGIN` | only while an app version is in review: `reviewer@yourdomain:123456` (see "App review" below) |

### 5. Build from GitHub (optional, easiest later on)

1. expo.dev → Account settings → **Access tokens → Create**. Copy it.
2. GitHub → the repository → Settings → Secrets and variables → Actions →
   **New repository secret**: name `EXPO_TOKEN`, value the token.
3. From then on: GitHub → **Actions → Build phone apps → Run workflow**. Pick
   the platform, and tick "send them to App Store Connect / Google Play" when
   you're ready to release.

---

## Testing before release

- **iPhone (TestFlight):** after a build finishes, run
  `npx eas-cli@latest submit --platform ios --latest`, or tick "send" in the
  GitHub workflow. In App Store Connect → TestFlight, add yourself and the
  presidency as internal testers. Install the **TestFlight** app to test.
- **Android:** `npx eas-cli@latest submit --platform android --latest` sends
  it to the Play **internal testing** track. Add testers' Gmail addresses.
- **New Google Play accounts must run a closed test with at least 12 testers
  for 14 days** before the app can go public. Ask a dozen quorum members with
  Android phones to join; they just install it from the test link and use it
  normally.

Check: sign in, turn on notifications (More), send yourself a message from
Admin → Messages, tap the notification, tap a calendar "Add to calendar" link,
and open a sign-in email link on the phone.

---

## Store listings (suggested text)

- **Name:** My Ward Link
- **Subtitle (Apple, 30 characters):** Your ward, organized
- **Short description (Google, 80):** Lessons, calendar, sign-ups and messages
  for your ward and its organizations.
- **Description:**
  > My Ward Link keeps your ward and its organizations organized in one place.
  > See this Sunday's lesson and share your thoughts, get reminders, sign up
  > to help with meals and service projects, see the ward calendar, and hear
  > from your leaders by notification, text or email. Leaders can schedule
  > lessons and teachers, send messages, plan visits and more.
  >
  > Joining a ward takes its join code from your ward's leaders.
  >
  > My Ward Link is an independent app run by volunteers. It is not an
  > official app of The Church of Jesus Christ of Latter-day Saints, and is not
  > affiliated with or endorsed by the Church.
- **Category:** Lifestyle (or Productivity)
- **Keywords (Apple):** ward,lessons,calendar,sign-ups,ministering,quorum,relief society,primary
- **Privacy policy URL:** https://mywardlink.net/privacy
- **Support URL:** https://mywardlink.net
- **Screenshots:** take them on your phone in the TestFlight / test build
  (Home, Lessons, Calendar, a sign-up). Use a demo ward without real members'
  names.
- Don't use Church logos, the Christus image or "LDS"/"Church" in the name,
  icon or screenshots.

**App privacy (Apple) / Data safety (Google):** the app collects **name**,
**email address and/or phone number**, and **user content** (comments,
messages, sign-ups), plus a **device token** for notifications. All of it is
linked to the person, used only for app functionality, never for tracking or
ads, and never sold. Data is encrypted in transit. People can delete their
account in the app (More → Delete my account).

---

## App review

Apple turns down apps that look like "just a website in a wrapper"
(Guideline 4.2). The app is built to show reviewers what a website can't do,
and the review notes below point it out.

**What's native in the app:**

- A native tab bar (Home, Lessons, Calendar, Plans or Service, More) with
  badges; tapping the tab you're on scrolls to the top, with haptic feedback.
- Push notifications through Apple and Google, the unread count on the app
  icon, and tapping a notification opens the right page.
- Lock with Face ID / Touch ID / fingerprint (More → Privacy).
- The phone's share sheet for invitations, flyers and sign-up links.
- Sign-in codes offered above the keyboard; links to the site open in the app;
  calendar links go to the phone's calendar; pull to refresh; an offline screen.

**Before submitting:**

1. Site owner page → **App Store review** → enter an email you can receive
   (e.g. `appreview@mywardlink.net`) → **Set up the demo ward**. This builds
   "Maple Grove Ward (Demo)" with made-up people, lessons, events, a service
   sign-up and a plan, and a plain member account for the reviewer. Nobody
   real is in it.
2. On Northflank, set `REVIEW_LOGIN` to that email, a colon, and six digits you
   pick: `appreview@mywardlink.net:482913`. That email then signs in with that
   code and no email is sent. It only works for an account that is in the demo
   ward and nowhere else, and wrong guesses are limited like any code.
3. Paste the review notes below into App Store Connect (App Review
   Information → Notes) and Play Console (App access), with the email and code
   under "Sign-in required".
4. After approval, remove `REVIEW_LOGIN`. Put it back for the next review.

**Review notes (paste this):**

> My Ward Link is for members of a local congregation ("ward") of The Church
> of Jesus Christ of Latter-day Saints: weekly lessons, the ward calendar,
> service sign-ups, and messages with their leaders. It is run by volunteers
> and is not affiliated with the Church.
>
> Demo account: on the sign-in screen enter EMAIL and tap the button under it
> ("Send me a code" or "Email me a sign-in link"; nothing is actually sent to
> this account), then enter the code CODE. It opens a demo ward of made-up
> people.
>
> Native features to try: the tab bar at the bottom; More → Notifications →
> turn on notifications (reminders and messages arrive as push notifications,
> update the app icon badge, and open the right screen when tapped); More →
> Privacy → Lock with Face ID; Service → a sign-up, and sharing it with the
> share sheet; Calendar → an event → Add to Apple / Outlook calendar.
>
> Content from members (lesson comments, messages) only goes to their own
> ward's leaders: comments wait for a leader's approval before anyone else sees
> them, and leaders can hide any comment. Accounts can be deleted in the app
> (More → Delete my account).

---

## Releasing an update to the app itself

Only needed when something in `mobile/` changes (website changes appear in the
app on their own):

1. Raise `version` in `mobile/app.config.js` (e.g. 1.0.1). EAS raises the
   build number automatically.
2. Run the GitHub workflow with "send" ticked (or `eas build` then
   `eas submit`).
3. In App Store Connect / Play Console, add the new build to a release and
   submit it for review.
