# Leader guide

How to do everything in My Ward Link as a leader: a bishopric, an
organization presidency, a ward administrator or the site owner. It also
describes what members see, so you can answer their questions.

## Asking this guide

**Admin → Leader guide** has a box at the top. Ask in your own words, like
"How do I turn off texting?" or "Why didn't Sister Lee get my message?". You
get a short answer, written by AI from this guide only, with links to the
sections that cover it. Below the answer, every part of the guide that mentions
those words is listed. The site owner turns the answers on by setting
`ANTHROPIC_API_KEY` on the server; without it the box is a word search. Each
leader can ask up to 40 questions an hour. Only the question you type (and this
guide) is sent to Anthropic's Claude to write the answer, never anyone's
information.

**Members have their own guide** under **More → Help**, with the same Ask box. It
covers only what members can see and do (no leader tools), so it's the place to
point members with questions about the app. Leaders can open it too.

## Who can do what

- **Members** use the app: Home, lessons, the calendar, service, plans,
  challenges, messages, My assignments and private to-dos, Request a visit,
  Reminders & alerts, My reminders, My organizations, Contact & notifications
  and Customize Home.
- **Leadership** in an organization (its presidency, or the ward's bishopric
  with its secretaries and clerks) gets **Admin** for that organization:
  members, lessons, messages, visits, assignments, meetings, approvals and
  settings. Access level (**Member** or **Leadership**) and calling are set per
  organization under **Admin → Members → (name)**.
- **Callings** (set on a person's page under Admin → Members): for an
  organization, President, First Counselor, Second Counselor, Secretary,
  Assistant Secretary and Stake High Council; for the bishopric, Bishop, First
  Counselor in the Bishopric, Second Counselor in the Bishopric, Executive
  Secretary and Ward Clerk. Only one President (or Bishop) at a time: choosing a
  new one clears it from the previous person. Callings decide who conducts each
  month and are shown to members choosing who to write to.
- **Ward administrators** (up to two per ward) manage the whole ward under
  **Admin → Ward settings**: its name, time zone, join code, organizations, the
  backup person for members' messages, members' messages ward-wide, and starting
  another ward. They don't have to be leaders, and the bishop can be one but
  doesn't have to be. Until any are chosen, the bishopric (and whoever started
  the ward) manages Ward settings; once they're chosen, only they and the site
  owner can open it.
- **The site owner** runs the app itself under **Admin → Site owner**: every
  ward, new wards to approve, texting and its billing, email, backups, the Come,
  Follow Me schedule and more (see **Site owner**). Site-owner access goes to
  whoever set up the first ward and to anyone signed in with the verified
  `OWNER_EMAIL` address; the page lists everyone who has it.
- **The backup person** (chosen in Ward settings) and the bishopric see **Admin
  → Pass it on** for members' messages that had nowhere to go.

What one organization's leaders do stays in that organization: private
messages, visits, conversations, meetings and assignments aren't seen by other
organizations' leaders or by the bishopric.

## The Admin page

Tap **Admin** (top of the screen; on a phone, top right). A red number on it is
how many items are waiting on you. If they're all in one place, tapping the
badge goes straight there. Unread messages aren't in this number; they show on
**Messages**.

The Admin page has these sections:

- **Waiting on you**, only when something is: **Couldn't reach** (see **Did they get it?**), Visit requests, Visit invitations
  (a member asked for another time), Teacher notes to approve, Comments to
  approve, Access requests (old requests to join without a code; bishopric
  only), Event requests, Teaching volunteers, Teacher needed, Assignments not
  accepted yet and Unassigned assignments.
- **Presidency** (or **Bishopric**): Presidency meetings (with how many items
  are on the next agenda and records to review), Assignments (open and
  overdue), Home visits (upcoming visits and open invitations), Visit requests,
  Who's conducting, Challenges, Members and Invite members. Tiles for features
  your organization turned off don't show.
- **Ward**: Pass it on (only when something is waiting), Ward settings (ward
  administrators) and Site owner (site owner).
- **Setup**: Message groups, Shared publicly, Message wording, Settings and
  Leader guide.

Lessons, events, service and plans aren't on Admin; each has its own tab
(Lessons → Manage lessons, Calendar → Add event, Service → New service
opportunity, Plans → New plan).

Ward administrators, the site owner and the backup person have the Admin tab
even where they aren't leaders; there it shows only the Ward section. If you
open Admin while looking at an organization you don't lead, it says so and
lists **Go to (organization) admin** for each organization you lead, in any
ward.

## Getting around

- **Tabs:** on a phone the bottom bar has Home, Lessons, Calendar, Plans and
  More. Lessons and Plans show only where the organization uses them; if one is
  off, **Service** takes its place (otherwise Service is under **More →
  Service**). Messages (the speech bubble, with a red unread count) and Admin
  are at the top. On a computer the top bar has Home, Lessons, Calendar, Plans,
  Service, Messages, Admin and More.
- **Switching organization or ward:** tap the name at the top left. It lists the
  ward and every organization in every ward you're in (grouped by ward if more
  than one). Lessons, service, messages and admin tools are for the
  organization you're looking at; the choice is remembered. Everyone in the
  ward can look at every organization. The bottom link is **My organizations
  and notifications**.
- **The ward level:** switch to the ward itself to see everything at once:
  Calendar has every organization's events, Plans every plan and Service every
  organization's opportunities, each labeled with where it's from.
- **More** lists: Service (if the organization uses it), Challenges, My
  assignments, Reminders & alerts, My organizations, Messages, Request a visit,
  Customize Home, My reminders and Contact & notifications. Then Church apps
  (Gospel Library, Member Tools), Notifications (on or off for this device),
  Privacy (in the phone app: **Lock with Face ID** or fingerprint),
  **Appearance** (Automatic, Light or Dark), the account (name, phone or email,
  access level or calling, Privacy and Terms links, **Sign out**) and **Delete
  my account**.
- **Red dot on More:** unread Reminders & alerts only. Unread messages show on
  Messages. In the phone app, the icon's number is unread messages plus alerts.

## Wards and organizations

The app holds **wards**, and each ward has **organizations** (Elders Quorum,
Relief Society, Young Men, Young Women, Primary and Sunday School come with
every ward) plus the ward itself, led by the bishopric.

- **Leaders are per organization.** Someone's access level and calling are set
  separately in each organization.
- **Joining:** everyone joins a ward with its join code, then chooses under
  **More → My organizations** which organizations they belong to and which they
  get notifications from (see **Members joining and the member list**).
- **Another ward:** someone serving in two wards (a stake calling, say) enters
  the second ward's join code under **More → My organizations → Another ward →
  Join ward**, then switches between wards at the top. Wrong codes are limited
  to 10 a day.
- **Texts** name the ward and organization ("Villas Ward Relief Society: …").
  The monthly text limit is for the whole ward and is set by the site owner.

**Starting a ward.** Anyone can start one from the website's **Start a ward**
page (ward name, stake, time zone, their name and calling, a mobile number or
email, and an optional note to help confirm the ward), and ward administrators
can start another from **Admin → Ward settings → Another ward → Start a new
ward** (at most 3 a day). Every new ward is set up right away (with the
standard organizations) but stays **under review**: whoever started it sees
"Your ward is under review", nothing can be done in it, it can't be joined, and
nothing is sent from it, until the site owner checks it's real and approves it
(usually within a day). The site owner is notified with the starter's name and
contact. The starter is emailed when it's approved (or, if declined, with the
site owner's note). The starter leads it until its bishopric is added. A ward
the site owner starts opens right away.

## Ward settings (ward administrators)

**Admin → Ward settings**, for the ward's administrators (or, until they're
chosen, the bishopric and whoever started the ward; the site owner can always
open it):

- **Ward administrators:** choose up to two people from anyone in the ward. New
  ones are notified. Clearing both hands Ward settings back to the bishopric.
- **Ward:** the ward's name and time zone.
- **Messages from members:** **Members can send messages to their leaders in the
  app**. Turn it off to use the app only to send information out (see **Turning
  off messages from members**).
- **Backup for members' messages:** who gets members' messages that an
  organization can't receive (it's turned off, or has nobody in its
  presidency). With nobody chosen, it's the bishopric. They pass them on from
  **Admin → Pass it on**.
- **Join code:** **Make a new code** (the old code and QR code stop working
  right away), or type your own (6 to 20 letters, numbers or hyphens, not used
  by another ward) and tap **Use this code**. **Show QR code to invite members**
  opens Invite members.
- **Organizations:** each row shows how many members it has, "no presidency
  yet" if none, and **Open**.
  - **Turn off** one you don't use: it's hidden from members and sends nothing;
    nothing is deleted. **Turn on** brings it back.
  - **Choose its president… → Set president** for one with no presidency; the
    president then adds counselors and a secretary from Admin → Members.
  - **Delete** removes it and everything in it (lessons, events, service,
    messages, visit records) for good, after you confirm.
  - **Add an organization:** name (suggestions from the standard list),
    president (optional) and what it uses. A name already used is refused; turn
    the existing one on instead.
- **Another ward → Start a new ward** (see **Starting a ward** above).

## Organization settings (Admin → Settings)

**Admin → Settings**, for the presidency (or the bishopric, looking at the
ward):

- **Name:** an organization's presidency can rename it (not the ward).
- **What (organization) uses** (titled **Features** at the ward level): turn off
  what you don't use and it's hidden from everyone in your organization. Nothing
  is deleted; turning it back on brings it all back.
  - Lessons and teachers
  - Members' comments on lessons (study thoughts)
  - Service opportunities
  - Visits and visit requests
  - Assignments and presidency meetings
  - Who's conducting (presidency rotation)
  - Event suggestions from members
  - Plans (the Plans tab)
  - Message groups
  - Challenges between organizations (an organization that turns them off can't
    be put on a team)
  - Public links and QR codes (flyers, sign-ups)

  A leader who opens a turned-off feature's page is taken to Settings with a
  note saying it's off.
- **Messages from members:** **Members can write to the presidency** (the whole
  presidency or bishopric) and **Members can message me** (just you). See
  **Turning off messages from members**.
- **Reminder times:** when your organization's automatic reminders go out. Only
  the parts for features you use are shown.
  - **Lesson reminder** to everyone: up to two, each on a day (the Sunday
    before, Monday through Saturday, or Sunday morning) at any time, or **No
    reminder**. Starts as the Sunday before at 7 PM and Saturday at 8 AM.
    Members who set their own lesson reminders get theirs instead.
  - **Teacher's reminder** ("You're teaching this Sunday"): the same choices,
    set separately. The teacher gets this instead of the lesson reminder.
  - **Visit reminder:** 1, 2, 3, 4, 6 or 12 hours or 1 day before a planned
    visit, or none (starts at 3 hours). It goes to the presidency, whoever is
    going, and the member if they were told. Never before 7 AM: a reminder that
    would be earlier goes at 8 PM the evening before. None also stops the
    member's reminder.
  - **Service and assignment reminders go out at:** 5 AM to 12 PM (starts at
    8 AM). Which days is chosen on each opportunity or assignment. Visits with
    no time are reminded at this hour too.
  - **Presidency meeting reminder:** 15 or 30 minutes, 1 or 2 hours, or 1 day
    before, or none (starts at 1 hour). Changing it updates meetings already
    scheduled.

  Event reminders are set on each event, and private to-do reminders on each
  to-do.
- **Texting** (when texting is set up): how many reminder and message texts the
  ward sent this month, out of its limit. Only the site owner changes the limit
  or turns texting on or off.

## Members joining and the member list

The app never uses Church records. Members join themselves with the ward's join
code, or a leader adds them.

- **Admin → Invite members** (any leader): the ward's QR code and join code.
  - **In a meeting:** **Show on a big screen** opens a page for a projector.
    Members scan the QR code, type their name and email (the code is filled
    in) and enter the 6-digit code emailed to them.
  - **Send it to the ward:** the join link, with a **Share** button. Anyone with
    the link can join, so make a new code (Ward settings) if it gets shared
    outside the ward.
  - With no code yet, a ward administrator sees **Create a join code**.
- **Joining** (the website's Join page): their name, a mobile number or email
  (email only in a ward with no texting), the ward join code (required) and a
  box agreeing to what the app keeps, then a 6-digit code. Someone who already
  has an account is sent to Sign in.
- **Added by a leader:** **Admin → Members → Add a member**: their name, a
  mobile number or email, and access level (Member or Leadership). Someone who
  already has an account in your ward is just added. Until they first sign in,
  their page has an **Invite** card: **Text invite** (sends from **your own
  phone**: the app never texts a number you typed in until that person agrees
  to texts themselves), **Copy**, and **Email invite**. The first time they sign
  in, a welcome screen has them confirm their name, agree to what the app keeps,
  and choose "When notifications are off, how should we send reminders and
  messages?" (Text me, Email me, Both, or Neither). Texting is never chosen for
  them. Members marked **No texts** get only the sign-in codes they ask for.
- **Old access requests:** joining now always needs a code. Requests to join
  without one from before that show under **Admin → Access requests** (bishopric,
  at the ward) until handled, and are deleted after 60 days.
- **Signing in:** members enter their mobile number or email and choose **Keep
  me signed in for** (just this time, 1 day, 30 days or 1 year), then get a
  6-digit code (email also gets a sign-in link; in the iPhone app, type the code,
  since the link opens Safari). Only the newest code works, and after 5 codes in
  an hour they must wait. In a ward with no texting, a phone sign-in sends the
  code to their email.

**Admin → Members** lists your organization's members (at the ward level,
everyone who joined the ward; in an organization, everyone who chose it, plus
anyone a leader added). Each row shows calling or role, **Phone** and **Email**
badges, **No texts**, **Can't be reached** (see **Did they get it?**), **Turned
off (organization) notifications**, and when they last signed in. Search by
name, and show **Active** or **Turned off**. **Print** gives one clean page of
names, callings, phone and email; **Export (Excel)** a spreadsheet for Excel,
Numbers or Google Sheets. Both follow the search and contain contact info: keep
them within leadership. For addresses, use Member Tools.

**A member's page** (Admin → Members → name):
- **Access level** and **Calling**. You can't take Leadership from the last
  presidency member of an organization.
- **Status** (bishopric, for someone in no other ward): Active, or **Turned off:
  can't sign in** (signs them out everywhere and sends them nothing).
- **Organizations:** the bishopric (looking at the ward) can tick any
  organization for them; a presidency can tick its own. Leaders of an
  organization can't be unticked there; change their access level instead.
- **Contact info:** leaders can fix the name, phone or email only for someone
  who hasn't signed in yet (and isn't a leader or in another ward). After that,
  only the member changes it, under More → Contact & notifications.
- **Send a personal message**, **Invite to a home visit**, **Record a visit**,
  and their visit **History** (last visit shown).
- **Remove from (ward)** (bishopric, at the ward): takes them out of the ward
  and all its organizations. If they're in no other ward, their account and
  everything they posted are deleted. They can rejoin with the code.
- **Remove from (organization):** they stay in the ward and can choose the
  organization again themselves.
- You can't turn off or remove the only presidency member of an organization.

## How members are notified

Every reminder and message reaches each person the way they chose under **More →
Contact & notifications**:

1. **App notifications** go to every phone and computer where they turned them
   on (free).
2. **Also send every reminder and message by:** tick **Email** and/or **Text**
   to get those every time too, even when the notification arrived.
3. **If a notification doesn't reach you:** **Text**, **Email**, **Both** or
   **Nothing**. Used only when no app notification reached them and neither box
   above is ticked (or a ticked one failed, like at the text limit). Text
   without a usable phone falls back to email, and the other way round.

So a member who wants app notifications and email but no texts turns
notifications on, ticks Email, and leaves Text unticked.

**New members start with everything on.** Someone who joins gets every reminder
and message by the way they joined with (text for a phone number, which they agree
to when joining; email for an email), plus app notifications once they turn them
on. Adding an email later turns it on for everything too; adding a phone number
has a **Send me reminders and messages by text** box right under it (ticked to
start; unticked, the number is only for sign-in codes). They change any of it under
Contact & notifications. Members a leader added choose on their welcome screen
instead. Keep an eye on the ward's monthly text limit (Admin → Settings → Texting)
as more people get everything by text.

**Contact & notifications** also has their **Mobile number** and **Email**:
each shows "✓ confirmed" with **Remove**, or a box to add one with **Send code**
(a 6-digit code, good for 20 minutes). They can't remove their only way to
sign in, and a number or email already on another account is refused. In a ward with no texting the phone row says
"Your ward uses email"; before texting is set up it says "Coming soon"; while
the phone carriers are approving the app's number, members can choose Text now
but get email until it starts.

**Turning on notifications:**
- **In the phone app:** More → Contact & notifications → **Turn on
  notifications**. If they're off in the phone's settings, the page says so and
  their backup choice is used meanwhile.
- **iPhone without the app:** in Safari, tap **Share → Add to Home Screen**,
  open the app from the Home Screen, then turn notifications on. Until then they
  get email.
- **Other browsers:** "Notifications are blocked for this site" means they must
  allow them in the browser's settings; some browsers can't receive them, so
  email is used.
- On Android and computers, browser notifications stay on screen until tapped;
  on iPhone each person can choose **Settings → Notifications → (the app) →
  Banner Style → Persistent**. Tapping a notification opens the right page.

**More → My reminders** (also 🔔 **My reminders** on Lessons, Calendar and
Service): for **Lessons**, **Events** and **Service** separately, each member
chooses **As scheduled** (the organization's times), **My own reminders** or
**No reminders**, and taps Save.
- **My own reminders:** **+ Add a reminder** (up to 10 in each area, up to 3 by
  text), each with a time and any mix of **App**, **Text** and **Email** (Text
  only if their ward texts and they agreed to texts; Email only if they have
  one). Lesson times: the Sunday before 7 PM, Wednesday 7 PM, Friday 7 PM,
  Saturday 8 AM, Saturday 7 PM or Sunday 7 AM. Events and service: 15 minutes to
  2 weeks before. If none of the chosen ways reach them, the app tries a
  notification, then email.
- Service reminders count from the opportunity's start time (or 9 AM that day
  if it has none).
- Teachers still get their teaching reminders.

**More → My organizations:** for each organization, **I belong to (name)**
(puts them on its member list, lets them write to its leaders and ask it for a
visit, and shows its events in Coming up and their subscribed calendar) and
**Send me its notifications** (its reminders, events and messages). Leaders'
notifications can't be turned off there. **Send me ward-wide notifications (from
the bishopric)** is for the ward. Members who turn off an organization's
notifications aren't sent messages to everyone in it, and leaders see who (see
**Did they get it?**).

**More → Reminders & alerts** keeps the full text of every reminder and alert
sent to them for 30 days, with **Open** and **Mark all as read**. Messages
aren't there; they're in **Messages**.

**Late reminders:** the app checks every minute. A lesson reminder or a
member's own reminder that was missed (the server was down) still goes out up
to 6 hours late, never twice; an event reminder more than 6 hours late is
skipped, and so is a private to-do reminder. Service and assignment reminders go
out between the morning hour and 8 PM that day.

### Did they get it?

Every notification records how it reached the person: app notification, email,
text, or nothing.

- **Sent messages** (Messages → Sent) show **Opened by 12 of 30**. Tap it to see
  who **couldn't be reached** (no app notifications, and no email or texts they
  allow), who **turned off notifications** from your organization (they weren't
  sent it), and who hasn't opened it in the app yet (they may have read the email
  or text).
- **Assignments** show how the person was told and whether they've seen it. If
  they couldn't be reached, there's a red warning with the reason (for example,
  they turned off email and text backups and have no app notifications), and
  you're told right when you save it, so you can tell them in person.
- An **assignment request** still unopened after 2 days is sent once more by
  email and text (between 9 AM and 8 PM).
- **Admin → Members** marks anyone the app **can't reach** and anyone who
  **turned off** your organization's notifications.

**Couldn't reach (Waiting on you).** When something sent directly to a person
reaches them by no means at all, it goes on **Admin → Couldn't reach**, which the
whole presidency sees and which counts in **Waiting on you**. That covers
assignment requests, "Can you take this assignment?", "Will you teach?", being
assigned to teach or made a regular teacher, notes sent back, "Can you conduct?",
visit invitations, replies to visit or event requests, and personal or private
messages. A message to a group adds one item listing everyone it missed. Each item
shows who, what it was about, why they couldn't be reached, and buttons to **Call**,
**Text from my phone** or **Email** them if there's a number or address. Once
someone has told them, tap **I told them**: it moves to **Recently handled** with
your name, so the rest of the presidency knows. Sending the same thing again
doesn't add a second item. Handled items are cleared after 30 days.

A notification that arrives on a phone with notifications muted can't be
detected, so "not opened yet" is the thing to watch, and for assignments,
whether they've accepted.

## Texting

- **Who gets texts:** only members who agreed to texts (by adding their number
  themselves, or choosing texts on the welcome screen), and only for what they
  chose under Contact & notifications.
- **Monthly limit:** each ward has one (500 to start), set by the site owner. It
  counts reminder and message texts plus members' texted replies, per calendar
  month. Sign-in and confirmation codes are always sent and don't count. At the
  limit, texts pause until next month and members get email or their backup
  choice instead. Admin → Settings → Texting shows the count.
- **Texting off** (by the site owner, or past the ward's paid-through date):
  sign-in codes are still texted; everything else goes by notification or email.
  **No texting at all:** nothing is texted, not even codes.
- **What texts look like:** notices read "(Ward Organization): Title. Text",
  shortened to 280 characters, with a short link that opens the right page.
  With the phone app installed the link opens the app; in a phone's browser
  someone not signed in sees **Open the app** on the sign-in page, and signing
  in there still lands on the right page. (Opening links straight in the app
  needs `APPLE_TEAM_ID` and `ANDROID_CERT_SHA256` set on the server; see
  docs/MOBILE-APP.md.)
  Personal messages and visit reminders are just your words, signed "- Name".
- **STOP:** a member who texts STOP (or STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT)
  gets no more texts: their consent is withdrawn and their backup becomes email
  (or nothing if they have no email). To get texts again they tick Text under
  More → Contact & notifications and text START to the app's number. HELP is
  answered automatically.
- **Texting back:** a member's texted reply goes to the organization that last
  texted them, and its presidency is notified (see **Messages**). More than 20
  texted replies from one member in an hour are ignored.
- **TEACH / CANT:** a member can text **TEACH** (or "teaching") or **CANT**
  ("can't", "cannot") plus a reason. A waiting "Will you teach?" request is
  answered first (the newest, if several); otherwise it confirms or declines
  their lesson in the next 8 days. Anything else is treated as a message to the
  presidency. They get a short thank-you back.
- **A number not in the app** gets one reply (at most once a month) saying it
  wasn't delivered and to use their number on file or the app.
- **Two members sharing a number:** texts to it go to the one who signed in most
  recently.

## Messages

Tap **Messages** at the top (the speech bubble on a phone).

**Sending anything: Messages → New message.** One **To** field, like email:
**Everyone**, **the Presidency**, **Upcoming teachers** (next 5 weeks), any
message group, or **One person…** (tick **Private** to keep it out of the rest
of the presidency's view; it opens your conversation with them). If you lead
more than one organization, the choices are grouped by organization, and the
number next to each is how many people get it.
- **Attach a flyer** (a PDF or picture): it shows full size when members open
  the message, with a small preview in their inbox, comes attached to the email,
  and texts get a link to see it.
- **Link to a page:** an announcement can carry an **Open Lessons / Calendar /
  Plans / Service** button.
- **Add to the next presidency meeting's agenda** puts it on the agenda (ticked
  already when writing to the presidency).
- After sending you're told how many it reached by notification, email and
  text, and how many couldn't be reached or turned off your notifications.

**Your inbox:** leaders see three tabs and a **New message** button:
- **Inbox:** one row per person who has written to you (and a separate row for
  each private conversation), from every organization you lead, newest first. A
  blue dot and count mean unread; **Needs reply** means their message is the last
  one; **Private** marks a private conversation. **Unread** shows only what's new,
  and the search box finds someone by name.
- **Sent:** announcements sent to everyone, the presidency, teachers or a group,
  with who sent them, how many were reached by each way, and **Opened by …**.
- **My messages:** your own messages as a member, exactly as members see them,
  with its own Inbox, Sent and New message (to write to another organization's
  leaders).

**In a conversation:** the whole back-and-forth, like a text thread. New
messages appear while it's open. Under your last answer it says **Seen** once
they've read it. Links, emails and phone numbers can be tapped. Your unfinished
reply is kept if you leave; **Ctrl+Enter** (⌘+Enter on a Mac) sends. **Mark as
unread** keeps it in your Unread list. Each leader has their own read and
unread. Tap **+ Add to the next presidency meeting** under a member's message to
put it on the agenda, or **Forward…** to send it elsewhere.

**What members see:** a **New message** button and two tabs. **Inbox** has one
row per conversation (with the whole presidency, or privately with one leader)
and one per announcement, across all their organizations; a blue dot means
unread. Tapping an announcement shows it in full with a **Reply to the
presidency** box ("Only the presidency sees your reply, not everyone who got this
message"). **Sent** lists what they wrote; their last message shows
**Delivered**, then **Seen** once a leader reads it. New message's **To** offers
the whole presidency (or bishopric), **Only (calling or name) (private)**, or a
group that lets members send, for organizations they belong to and the
bishopric. Messages are up to 1,000 characters.

**Personal messages:** to write to one member, open them in **Admin → Members →
Send a personal message**, or use New message → One person. There's no subject.
Their text or email is just your words, signed "- Your Name", with no ward header
and no link. The rest of the presidency sees the conversation unless you choose
**Private** (then they're told only "Private message from (your name)" and read it
in the app).

**Private messages from members:** a member can choose **Only** one presidency
member (for example the President). It shows only to that person, marked
**Private**; the rest of the presidency can't see it. The notification, text and
email say only "Private message from (name)", without the words, in case someone
else sees the phone or inbox; open the app to read it. Your private answers reach
the member the same way. If the
member texts back after a private reply, their text stays private too. If that
leader's account is deleted, their private conversations are deleted with it.

**When a member writes to you,** your text, email and notification carry their
whole message, so you can read it without opening the app (except private
messages, which say only who it's from). To answer, **just
reply to that text**: it goes to the member (privately if theirs was private),
signed with your name. Or answer in the app with the link. Replying to an
**email** doesn't reach them; use the button in the email.
- A texted answer goes to the member whose message came to you most recently
  (in the last 3 days).
- **More than one person writing:** the app holds your reply and texts "Who is
  this for? Reply 1 for … or 2 for …" (up to 6 names). Answer with the number
  within 15 minutes, or the held reply is dropped and you'll need to send it
  again. Once you've answered one, your next reply goes to the one still waiting.
  If you lead in more than one ward or organization, everyone waiting on you is
  included.
- **Pick the person yourself:** start your reply with their name and a comma,
  e.g. "Hyrum, see you at 7". A first name is enough; if two people who wrote
  have that name, the app asks which (or use the full name). A colon works too
  ("Hyrum: see you at 7") and leaves the name off.
- Replies to teaching requests (TEACH / CANT) are still handled as teaching
  answers.

**When members reply to you** (in the app, or by texting back to anything you
sent), it goes into their conversation and every presidency member is notified
(or just the one person, if private).
- **Two organizations texted them in the last 3 days?** Their text first gets
  "Which is your message for? Reply 1 for … or 2 for …" (up to 3). With no
  number in 30 minutes, it goes to whoever texted last.
- A member who texted gets an app notification saying where it went.
- **Went to the wrong place?** Tap **Forward…** under it: send it to another
  organization's presidency (or bishopric) or one leader. They see a "Forwarded
  by …" note, and the member's next texted reply goes to them.
- **Pass it on:** messages to an organization that can't receive them (turned
  off, or nobody in its presidency) go to the ward's backup person and the
  bishopric under **Admin → Pass it on**. Each shows who it was for and whether
  it came by text. Forward it to an organization's presidency or one leader, or
  tap **I took care of it another way**.

**Message groups** (Admin → Message groups): **Create a group**, name it, choose
its organization (if you lead more than one), tick **People in the group**, and
choose **who can see it and send to it**: the presidency and/or the people in the
group. When people in the group can send, it shows in the **To** list of their
New message; their message goes to the rest of the group, signed with their
name, and replies come to the presidency. **Save group** or **Delete group**.
Each group's page has **Send a message to this group**.

Conversations are deleted after 6 months, and announcements after a year.

### Turning off messages from members

For leaders who only want to send information out, members writing to leaders
can be turned off at three levels:

- **The whole ward:** Admin → Ward settings → **Messages from members** (ward
  administrators). Members no longer see **New message** at all.
- **One presidency or bishopric:** Admin → Settings → **Members can write to the
  presidency** (anyone in it).
- **Just you:** Admin → Settings → **Members can message me**. Members can't
  write to you privately, and you aren't notified of their messages to the
  presidency (you can still read them in the Inbox). If everyone in a presidency
  turns this off, members can't write to it at all.

When it's off, there's no reply box, and messages and emails say they're for
information only. A texted reply isn't passed on; the member is told so by text
at most once a day. Leaders can still message members and each other. Visit
requests are separate: turn off **Visits and visit requests** in Settings.

## Lessons

### After each General Conference: set up six months of lessons

1. **Lessons → Manage lessons → 1. Add Sundays:** start date = the Sunday after
   conference, 26 weeks (1 to 60). Sundays that already have a lesson are
   skipped.
2. **General Conference** Sundays (the first Sunday of April and October) are
   marked for you. Tap any **Stake Conference** Sunday and set **This Sunday
   is** to Stake Conference. Those weeks show "no lesson" and reminders announce
   the conference instead.
3. **2. Paste talk links:** in Gospel Library on the web, open each talk and copy
   its address. Paste them all, one per line, in order. They fill the open
   Sundays from the next one, skipping Sundays that already have a talk or a
   conference, and the titles and speakers are looked up for you. If you paste
   more links than open Sundays, you're told how many are left over.
4. Open any Sunday to fix a title or change its date. Moving a lesson to a Sunday
   that already has one swaps the two.

### Manage lessons

**Lessons → Manage lessons** (presidency) lists every Sunday, with its own
**Waiting on you** box (Teacher needed, Volunteers to assign). Tap a Sunday to:
- Change **This Sunday is**: a talk, **A lesson on an assigned topic**, General
  Conference or Stake Conference. For a talk, paste its link and leave the title
  and speaker blank to have them looked up.
- **View as member.**
- **Assign anyone → Save teacher** (choose "(no teacher)" to remove the teacher
  and their notes). Assigning by hand means the regular teacher won't fill that
  Sunday.
- **Ask someone to teach** (future Sundays only).
- **Delete this Sunday** (the lesson and its comments).

**Assigned topics:** under *This Sunday is*, choose **A lesson on an assigned
topic** and fill in the **Topic**, optional **Details** (who assigned it, what to
focus on) and an optional link. It works like any other lesson; pasted talk links
skip it.

### Sunday School: Come, Follow Me

Sunday School's lessons fill themselves from Come, Follow Me: every week gets
that week's reading, title and Gospel Library link. Nothing to add or paste.
- **Weekly message:** "This week's Come, Follow Me" with the coming week's
  reading goes with any lesson reminder 2 or more days before Sunday (Reminder
  times; by default the Sunday before at 7 PM). Reminders 1 day or less before
  Sunday go out only for Sundays with a teacher.
- **Teachers:** assign them on the Sundays class meets. Weeks without a teacher
  just show the reading.
- **Changing a lesson:** tap the Sunday and change anything; it stays as you set
  it. **Refill from Come, Follow Me** puts it back.
- **Site owner, once a year:** see **Site owner → Come, Follow Me schedule**.

### What members see

The **Lessons** tab has **Upcoming** and **Past** (a lesson moves to Past after
1 PM that Sunday) and 🔔 **My reminders**. A lesson's page has **Read the talk in
Gospel Library** (or this week's Come, Follow Me, or the topic's link), the
teacher (with ✓ confirmed), the teacher's notes once shared, **I'd like to teach
this**, and **Study thoughts** (comments). Conference Sundays say there's no
lesson, with a link to General Conference. Home shows "This Sunday" for each
organization they're in.

## Teachers

- **Regular teachers** (Lessons → Manage lessons → *Regular teachers*):
  - Choose who teaches the 1st, 2nd, 3rd and 4th Sunday of each month. They're
    put on those lessons automatically, including Sundays added later.
  - Each Sunday has one teacher; one person can have more than one (for example
    the 2nd and 4th).
  - 5th Sundays have their own slot, filled in each time: the card lists the
    next few; tap one to set its lesson and teacher (members can also offer).
    They never get a regular teacher. Conference Sundays are skipped.
  - Each teacher is notified once when added ("You're teaching on the 2nd and 4th
    Sundays of each month"), and if they're taken off. Their lessons show under
    My assignments, and reminders ask them to confirm.
  - Taking the teacher off one lesson, or them saying they can't, leaves that
    Sunday open. Changing a Sunday's regular teacher moves their upcoming
    automatic lessons to the new one; lessons you assigned by hand stay. These
    lessons show "· regular" next to the teacher.
- **Volunteers:** members tap **I'd like to teach this** on a lesson (they can
  **Withdraw**; you're told). You're notified. Manage lessons shows "2
  volunteered"; open the lesson and tap **Assign** next to a name. The assigned
  teacher is notified. Only the presidency assigns teachers.
- **Ask someone to teach:** on the Sunday's page, choose a member, add an
  optional note and tap **Send request**. They get "Will you teach on Sun,
  Nov 1?" and answer **Yes, I'll teach** or **I can't teach this one** (with an
  optional reason) from the notification, a card on Home, the lesson page, a link
  that works without signing in, or by texting **TEACH** / **CANT**. Yes assigns
  them (already confirmed) and withdraws anyone else you asked. The whole
  presidency is notified either way ("Teacher found" or "Can't teach" with the
  reason). The lesson shows who was asked (Waiting for answer, Accepted,
  Declined, Withdrawn); **Withdraw** a waiting request (they aren't told). You
  can't ask the same person twice at once, or for past or conference Sundays.
- **Teacher's reminders:** by default the Sunday before at 7 PM and Saturday at
  8 AM (Admin → Settings → Reminder times): "You're teaching this Sunday" /
  "You're teaching tomorrow", with the title and whether their notes are posted,
  waiting for approval, or not added. They get this instead of the general lesson
  reminder.
- **Confirming:** the reminders ask them to answer **Yes, I'm still teaching** or
  **I can't teach this lesson** (with an optional reason): by tapping the
  notification or the email's button (a page that works without signing in),
  with the notification's buttons (browser notifications on Android and
  computers), on the lesson page, or by texting **TEACH** or **CANT** and a
  reason. You'll see **✓ confirmed** in Manage lessons; after confirming, later
  reminders just thank them.
- **When a teacher can't:** they're taken off, the lesson shows **Teacher
  needed** so others can volunteer, and the presidency is notified with the
  reason (only the presidency sees it). It shows under **Waiting on you → Teacher
  needed** until someone is assigned, and the lesson's page shows who couldn't
  teach and why.

## Teacher notes

The assigned teacher sees **"You're teaching this lesson: share notes with
everyone"** on the lesson page (**Submit for approval**). Their notes wait in
**Admin → Teacher notes to approve**, marked **New, sends a notification** or
**Edit to notes already shared**. **Approve and share** puts them on the lesson
page and notifies everyone (only the first time for each lesson; later edits are
approved quietly). **Send back to teacher** lets you add a short note; the teacher
is notified and can edit. Notes a leader writes or edits (**Save and share**) are
shared right away. If the teacher is removed or replaced, the notes they wrote are
removed; notes a leader wrote stay.

## Comments

Members share **Study thoughts** on a lesson: **Add a comment → Post comment**,
or **Reply** under an approved one (one level). Every new comment and reply,
including leaders', waits in **Admin → Comments to approve** (the member sees
"Waiting for approval" on theirs). Tap **Approve** or **Don't post** (or **Approve
all** when several wait). Tap **Hide** on any approved comment on the lesson page.
Members can delete their own. Turn comments off entirely in Settings.

## Calendar

**Adding an event:** **Calendar → Add (organization) event**, or tap a day →
**Add event on this day**.
- **Title**, **Starts**, **Ends**, **Location** (members can tap it for a map)
  and **Details** (links can be tapped).
- **Leaders only:** hidden from members; only this organization's leaders see it
  and get its notifications.
- **Reminder** (default the day before) and an optional **second reminder**:
  1 hour, 3 hours, 1 day, 2 days, 1 week or 2 weeks before.
- **Flyer** (a PDF or picture, up to 15 MB): shown on the event's page, with a
  small preview on members' home pages.
- **Ask people to RSVP:** members answer **Going**, **Maybe** or **Can't go**;
  everyone sees the counts, only leaders see names.
- **Send a notification** to everyone, just the presidency, or one of your
  groups when you save it.
- **Invite other organizations:** tick **The whole ward** or other
  organizations. They see it, get its reminders and can RSVP; only your
  presidency can change it.

**Changing an event:** tick **Send an update** to tell people. Under **Send it
to**, tick everyone, the presidency, any groups, the people who RSVP'd, or **the
same people as before**, and add anyone by name; each person gets it once.
**Delete event** removes it.

**Repeating events:** choose **Repeats**: every week, every 2 weeks, every month
on (for example) the third or last Friday, or every month on the same date.
**Ends:** never (dates are kept filled a year ahead), on a date, or after 2 to
200 times. Each date is its own event, with its own RSVPs and reminders. When you
edit or delete one, choose **only this date** or **this and all future dates**.
Changing the time or pattern for future dates clears their RSVPs; choosing "Does
not repeat" for future dates deletes the later dates.

### Events that last for weeks or months

For something like a temple open house that runs for months, add one event that
starts on the first day and **ends on the last day** (put the ticket link in
Details and attach the flyer). Anything lasting two days or more shows as
**Going on: …** at the top of the calendar for every month it covers and on any
day you tap, and on members' home pages as **Now through Feb 28**, instead of
sitting on its first day. Then send one message to everyone with the link.

### Event requests

Members can tap **Request an event** on the Calendar (if Event suggestions are
on): what it is, starts, ends, where and details. It goes to the organization's
leaders under **Admin → Event requests**. Add an optional note to the member and
tap **Approve** (the event is added with a 1-day reminder and opens for you to
adjust) or **Decline**. The member is notified either way, with your note.

### What members see

The calendar shows a month, with **Everything** and a chip for each organization.
Tap a day to list it (**Show whole month**, **Today**). An event's page has its
organization, who's invited, the date and time, location, flyer, **Add to Google
Calendar**, **Add to Apple / Outlook calendar**, **Share** (a link that needs
signing in) and the RSVP buttons.

**Subscribe:** on **Calendar → Subscribe**, members add a calendar to **Apple
Calendar**, **Google Calendar** or Outlook (**Copy link**, then Add calendar →
Subscribe from web) once. It holds ward events and events of the organizations
they belong to, in every ward they're in, and stays up to date (calendar apps
check every hour or a few times a day). Leaders' calendars include their
leaders-only events. Each link is private; **Reset my link** cancels an old one.
Members choose up to two reminders (15 minutes to 1 week; default 1 hour) put on
every event. On iPhone they must turn off **Remove Alerts** when subscribing;
Google Calendar ignores them. To stop, delete the calendar in the calendar app.

## Service

**Service → New service opportunity** (presidency):
- **Title**, **Date (optional)**, **Start time (optional)** and **Details**.
- **Slots:** each row is a slot's name (Volunteer, Bring a trailer, Monday
  dinner…) and how many people it needs (type it or tap − and +). **+ Add a
  slot** for another, ✕ to remove one. For meals, one slot per day with 1 person.
  Renaming a slot keeps who signed up; removing it removes their sign-ups (you're
  asked first).
- **Flyer** (a PDF or picture, up to 15 MB): shown on the opportunity's page
  (PDFs page by page), with a small preview in the Service list and on Home. Tick
  **remove** to take it off.
- **Reminders:** everyone signed up gets two, saying what they signed up for,
  from the hour set under Reminder times. **Reminder** and **Second reminder**:
  the morning of, 1, 2 or 3 days, or 1 or 2 weeks before, or none (start as a
  week before and the day before). Opportunities without a date don't send
  reminders.
- **Send a notification** when you create it; **Send an update** when you change
  it (same choices as events).
- **Closed: no more sign-ups** (when editing). **Delete service opportunity**
  removes it and everyone's spots.

**What members see:** **Service** lists open opportunities (at the ward level,
every organization's, labeled). On one, each slot shows "N of M" and who signed up
(everyone sees names). They add an optional note and tap **Sign me up**, and can
take more than one slot. **✕ Remove** next to their name cancels. Leaders can
remove anyone, and see **Show closed**, **Share**, **Share publicly** and
**Edit**. Leaders aren't notified when someone signs up. After its date, an
opportunity leaves the list; it's deleted 30 days after (180 days after it was
made, if it has no date).

## Sharing publicly (links and QR codes)

Share one thing with people who don't have an account: a picture or PDF, or a
service opportunity they can sign up for. Each link (and QR code) shows **only
that one thing**; nothing else in the app can be reached from it. (Turn this off
in Settings → Public links and QR codes.)

- **What you can share:** a service opportunity (open it → **Share publicly**),
  an event's flyer (open the event → **Share flyer publicly**), or a plan (open
  it → **Share publicly**: **the whole page**, including later updates, or one
  picture or PDF from it). Give it a title and an optional caption, tick **I
  understand. Make it public.** and tap **Make the link and QR code**.
- **Admin → Shared publicly** lists everything shared (type, who shared it and
  when, and for sign-ups how many signed up without an account), with **QR
  code** (download it for posters, bulletins or slides, or in the phone app press
  and hold to save it), **Copy link**, **Share**, **See what they see** and **Stop
  sharing**, which turns the link and QR code off right away ("This link isn't
  active"). Don't share pictures with members' faces, names or contact
  information without permission.
- **Signing up without an account:** on a shared service opportunity, people pick
  a spot and give their name and a mobile number or email (only email in a ward
  with no texting), then confirm with a 6-digit code (good for 30 minutes). They
  show as **Guest** (leaders see their phone or email; members see "Guest: John
  S.") and count toward the people needed. They get a confirmation with a link to
  cancel, and the opportunity's reminders. Leaders can **Remove** a guest (they
  aren't told). Closed opportunities refuse sign-ups.
- **Texts only with permission:** a guest is texted only if they tick the box
  agreeing to texts (the time and wording are kept); otherwise everything goes by
  email. A texted guest gets no reminders if texting is off or at its limit.
  Replying STOP ends texts.
- **Deleted:** guests' details 30 days after the date (90 days for an
  opportunity with no date); unconfirmed sign-ups after a day. When the
  opportunity is deleted, its link stops working.

## Plans

Plans belong to the ward, and show on the **Plans** tab (titled "Ward plans") of
the organizations they're for, where the organization uses Plans. Each plan is
for **the whole ward** (bishopric only) or **only these organizations**: a youth
temple plan for Young Men and Young Women shows on their Plans tabs and in the
ward's list, but not in Elders Quorum. Anyone in the ward can open any plan.

- **New plan:** Plans → **New plan**: title, who it's for, and **Send a
  notification that this plan was posted**. Then **Post plan**.
- **Building the page:** a plan is built from blocks. **Add: Heading, Text,
  Pictures or PDFs, Divider** (or drop files onto the page, or paste a picture;
  pick several at once). Pictures show right on the page and PDFs show their
  pages.
  - **Move** a block: drag its ⠿ handle (or ↑ ↓).
  - **Size** a picture or PDF: drag its blue corner, or tap S, M, L or Full.
  - **Place** it: Left or Right puts text beside it; Center on its own line.
  - Text has **B**, *I*, • List and Link buttons; add a caption under any picture.
    Each heading and text block has a size (Small, Normal, Large, Extra large).
- **Plan icon:** on the edit page, pick a drawn icon, an emoji, or **use your own
  picture**, then **Save icon**.
- **Update a plan:** open it → **Update plan** (tick to notify people again).
  Each save is kept: **Update history** on the edit page lists every save with
  who made it, and opens the plan as it was then. Members see only the current
  plan.
- **Who can edit:** the bishopric can create and edit any plan. An organization's
  presidency can create and edit plans for the organizations it leads, but not
  whole-ward plans.
- **Delete this plan** is at the bottom of the edit page (all versions).

## Assignments

**Giving an assignment:** **Admin → Assignments**, **+ New assignment** on More →
My assignments (presidency), **+ Assignment** on a meeting's agenda item, or **+
Add to the next presidency meeting** from a message. Choose anyone in the
organization (a presidency member or any member), a due date and optional
**time**, details, an optional **attachment** (a flyer, handout or picture, PDF or
image up to 15 MB, sent with the request), and two **Reminders**.

**Assignment requests:** giving one to someone else asks them "Would you be
willing to accept this assignment?" by notification and a card at the top of
their Home. They read the details and tap **Yes, I accept** or **I'm not able to**
(with an optional note).
- Until they accept, it shows **Not accepted yet** on the assignment and under
  **Waiting on you → Assignments not accepted yet**, and no due-date reminders go
  out. Unopened after 2 days, it's sent once more by email and text.
- Accepted: whoever gave it and the presidency are told.
- Not able to: it comes back **Unassigned** with their note, and the presidency
  (and whoever gave it) is told.
- Assigning it to yourself needs no answer. Changing it to a new person asks them.

**Reminders:** two you choose: from 2 weeks before to the morning it's due, or
none (start as the day before and the morning it's due), from the hour set under
Reminder times. Only for accepted assignments with a due date.

**Admin → Assignments:** filter by person and by **Open**, **Not accepted**,
**Unassigned**, **Overdue**, **Done** or **All**. Each row has a box to mark it
done, **Edit** and ✕ to delete. Choosing a person also shows what else they're
doing (lessons they're teaching, service they signed up for), to spread the load.

**On an assignment's page:**
- **Progress notes:** the person and the presidency add notes and set it to Not
  started, In progress or Done. The presidency hears about the person's updates;
  the person hears about the presidency's notes, except those marked **Presidency
  only**.
- How the person was told and whether they've seen it (see **Did they get it?**).
- **Ask someone else to take it** (presidency): one person or **the whole
  presidency**, with an optional note. They get "Can you take this assignment?" on
  Home with **Yes, I'll take it** and **I can't**. Yes makes it theirs and tells
  the presidency (and whoever had it). For the whole presidency, the first yes
  takes it; if everyone says no, whoever asked is told. **Withdraw the request**
  until it's answered.
- **I'm unable to do this assignment** (the person, once accepted): with an
  optional note. The presidency and whoever gave it are notified; it comes off
  their list as **Unassigned** with their note, and counts under **Waiting on you
  → Unassigned assignments** until someone has it.
- **Delete** (presidency): gone for everyone, with its notes and reminders (also ✕
  on Admin → Assignments and on "Assignments you've given"). To keep a record,
  mark it done instead.

Finished assignments come up for review 3 months after they're done (see
**Presidency meetings**).

## My assignments and to-dos (every member)

**More → My assignments** brings together, for every organization a member is in:
- 📋 assignments from a presidency (Please respond, Overdue, Due today, In
  progress);
- 📝 their own private to-dos;
- 📖 lessons they're teaching (Please confirm until they do; shown until Sunday);
- 🛠️ service they signed up for, with their slot (shown until its date).

Tabs: **Coming up** and **Done and past**. Home's **Your assignments** card shows
anything overdue, needing an answer, or in the next two weeks. Presidency members
also see **+ New assignment** and **Assignments you've given** (open ones they gave
others).

**My own to-dos:** **+ My to-do**: a private to-do with a title, details, a due
date and optional time, and its **Reminders**. Only they can see it; the presidency
can't.
- **+ Add a reminder** (up to 10): each is **When it's due**, 15 or 30 minutes,
  1, 2 or 3 hours, 1 or 2 days, or 1 or 2 weeks before. Without a time, they count
  from 9 AM on the due date.
- Members' reminders come as app notifications (or email if notifications are off).
  Presidency members can tick **Text** on up to 3 of them; the rest come as app
  notifications.

Tap it to edit, mark done or delete. Done to-dos are deleted after 6 months.

## Presidency meetings

**Admin → Presidency meetings** keeps the agenda, notes and decisions in one
place. Only the presidency (or bishopric) sees it.

- **The agenda builds itself.** Anything for the next meeting goes on *Agenda for
  the next meeting*: type it there; tick **Add to the next presidency meeting's
  agenda** when sending a message; or tap **+ Add to the next presidency meeting**
  under a member's message. Each item shows who added it and where it came from.
  Take one off with ✕.
- **Schedule a meeting:** date, time (starts at the last meeting's time) and an
  optional title. It goes on the presidency's calendar and Coming up, seen only by
  the presidency, with a reminder (1 hour before, or as set under Reminder times).
  The calendar event opens its agenda and notes. Changing the meeting's date or
  time moves the event; deleting the meeting removes it. Meetings are listed under
  **Coming up** and **Past meetings** (Today, Scheduled, Not finished, Review).
- **In the meeting:**
  - Tap an agenda item to take notes on it. An item with notes counts as
    discussed, and its notes show under **Notes → From the agenda**. *Other notes*
    is for anything not on the agenda. **Save notes** (can also change the date,
    time and title).
  - **Who was there:** a box for everyone in the presidency and anyone with a
    calling in the organization (secretary, assistant secretary, high councilor,
    and for the bishopric executive secretary and clerk), plus a line for others.
  - **+ Assignment** on an item turns it into an assignment; **Assignments from
    this meeting** lists them.
  - **Finish meeting** files the discussed items with the meeting; anything not
    discussed stays on the agenda.
  - **Delete meeting** removes it, its notes and its filed agenda (assignments
    stay).
- **Video meetings:** save your presidency's meeting link once (a Zoom personal
  room or recurring meeting, Google Meet or Teams; in Zoom, Meetings → Personal
  Room → Copy Invitation, which includes the passcode). Save it empty to remove it.
  **Start Zoom meeting** (or Google Meet / Teams) opens it; with **Let the rest of
  the presidency know** ticked, the others get a notification with a **Join**
  button. The button also shows at the top of an unfinished meeting.
- **Keep notes only as long as they're needed** (General Handbook): a meeting
  comes up for review 3 months after it's held, a finished assignment 3 months
  after it's done, and an agenda item after waiting 3 months. On the 1st of each
  month (from 9 AM) the president (or the whole presidency if no one has that
  calling) is notified. **Records to review** lists them (Meeting notes, Finished
  assignments, Agenda items waiting a long time) with **Keep 3 more months** or
  **Delete**. Nothing is deleted on its own.

## Who's conducting

- **By month**, from the callings set under Admin → Members: the president (the
  bishop, for the ward) in January, April, July and October; the first counselor
  in February, May, August and November; the second counselor in March, June,
  September and December. If a calling isn't set, those months show "no one" with
  a reminder to set callings.
- Presidency members see **Conducting this Sunday** on Home. Tapping it (or
  **Admin → Who's conducting**) shows the next 13 Sundays; conference Sundays show
  "no meeting".
- **Can't be there?** On your Sunday, tap **Ask someone to conduct**, choose
  someone in the presidency and add a note. They get a notification and a card on
  Home to answer **Yes, I'll conduct** or **I can't**. Yes notifies the whole
  presidency, and Home shows them conducting ("instead of …"). If they can't,
  you're told. Withdraw a request until it's answered. Whoever takes a Sunday can
  pass it on the same way.

## Visits

### Visit requests

Members ask from **Home → Would you like a visit?** or **More → Request a
visit**: who they'd like to hear from (one of their organizations' presidencies,
or the bishopric; chosen for them if there's only one), **A visit in my home**, **A
chance to talk (phone or at church)** or **Help with something**, best days or
times, and an optional note only those leaders see. A member can have one open
request with each. That presidency (or the bishopric) is notified ("(name) would
like a visit"; the note stays in the app) and it shows under **Waiting on you →
Visit requests**. Other organizations' leaders don't see it.

On **Admin → Visit requests**, each shows its kind, best times, the member's
phone, text and email links and their note:
- **Send reply:** a short message, like when you'll come by. It's also added to
  their Messages. The request shows **Replied**.
- **Schedule visit:** pick the date, time and who's going (see below). It shows
  **Scheduled**, with **Record the visit** and **Change**.
- **Mark visited:** closes it and opens **Record a visit**.
- **Close:** for requests handled another way (removes any planned visit).
- **Recently finished** lists closed requests for 30 days.

Members see the status (Sent, Scheduled, Visited, Closed, Cancelled) and any
reply, and can **Cancel request**.

### Planning a visit

**Admin → Home visits** shows **Upcoming visits** (who, when, who's going; Today,
Not recorded yet, Requested) and **Invitations**. A visit gets there by:
- **From a request:** Schedule visit, as above. The member is sent the date and
  time ("Brother Smith and Brother Jones plan to visit you Tue, Oct 14 at 7:00
  PM").
- **Plan a visit:** the member, date, time, **Type** (In their home, At church,
  Phone call, Text message), who's going, a note for the presidency, and **Let
  them know**: **Send a personal invitation they can answer** (wording you can
  change), **Just send the date and time**, or **Don't send anything (I'll contact
  them myself)**.
- **Invite to a home visit** on their page under Admin → Members: a personal
  invitation ("We would love to come visit you and your family in your home on
  Tuesday, October 20 at 7:00 PM…") you can change.

**Invitations:** they answer **Yes, that works for us**, **Suggest a different date
or time**, or **Now is not a convenient time for us**, from the notification,
email, text link or a card on Home. You're notified, and the answer is also saved
in their conversation. Until agreed, it's under **Invitations** (waiting, asked for
another time with their suggestion, or would rather not), with **Send a new time**,
**Change** and **Remove**. Settled it by phone? **Talked with them? Record their
answer**: **They said yes** (set the agreed time; optionally send a confirmation)
moves it to Upcoming visits; or **They want another time** / **They'd rather not
right now**.

**Reminders:** the presidency and everyone going get one before the visit (3 hours
by default; Admin → Settings → Reminder times), and the member gets a friendly one
if they were told ("Hi Hyrum! Just a quick reminder that Mark Johnson from the
Elders Quorum presidency is planning to visit you in your home today at 7:00 PM…";
a texted reply comes to the presidency). Never before 7 AM: then it goes at 8 PM
the evening before. A visit with no time is reminded at the morning reminder hour.
Only agreed visits get reminders.

**Afterwards:** **Record visit** (filled in from the plan) moves it to the history
and closes the member's request. **Change** reschedules; **Cancel** removes it (a
request goes back to Visit requests). If the member cancels their request, the
planned visit is removed and whoever was going is told. Planned visits never
recorded are deleted 30 days after their date.

### Recording visits

**Admin → Home visits → Record a visit:** member, date, type, who visited, notes and
**Follow-up needed**. **Visits made** has **Recent**, **By member** (everyone and
their last visit, never-visited first) and **Follow-ups** (with **Mark follow-up
done**). Edit or delete a record. Visits can only be recorded for people who have
joined. Keep notes brief: nothing you wouldn't text to another presidency member,
and never health, financial or worthiness details. Ministering interviews and
assignments stay in LCR. Recorded visits are kept until the member's account is
deleted.

## Challenges

A friendly competition between organizations, e.g. who does more temple and family
history work.
- **Starting one (presidency):** **Admin → Challenges → + New challenge**: a name
  and dates, the teams (each one or more organizations; an organization can be on
  only one team), and what counts and for how many points. Everyone on the teams is
  notified. Admin → Challenges also lists every challenge in the ward.
- **Logging:** members open it (**More → Challenges**, or the card on Home while
  it's on), choose their team if they're on more than one, what they did and how
  many, and tap **+ Log it**. "What you logged (only you see this)" lets them
  remove entries while it's running.
- **Scores:** each team's total points ("🥇 X leads by N points"). Only team totals
  are shown: no one sees what anyone else logged. Anyone in the ward can open a
  challenge; only team members can log.
- The day after it ends, everyone on the teams hears the final scores. Thirty days
  later, entries stop being tied to anyone; only the totals stay.
- **Edit challenge** (the presidency that started it, on its page): name, dates,
  teams and what counts. Points already logged stay with their team; changing
  something's points changes its total. Removing a team or something that counts
  removes what was logged for it (you're asked first). **Delete challenge** is
  there too.

## Message wording

**Admin → Message wording** (presidency) lists the reminders and messages the app
sends on its own: lesson reminders (and the conference-weekend one), Come, Follow
Me this week (Sunday School), event reminders, new event, event changed, service
reminders, new service opportunity, service opportunity changed, the visit
reminders (to the member and to the presidency), the visit invitation, and the
"date and time" message for a planned visit. Each shows **Your wording** or **App's
wording**. Open one to change its title (up to 120 characters) and text (up to
800) so it sounds like you; each organization keeps its own.

- Words in `{curly brackets}` are filled in (tap one to add it); each message
  lists what it can use, like `{first_name}` or `{time}`. A misspelled one shows as
  typed.
- Text in `[square brackets]` is left out when something in it is blank, so
  `[ at {location}]` disappears for an event with no place.
- The preview shows how it will read. A message can't be blank; **Reset to the
  app's wording** undoes your changes and shows who changed it last.

## A member's home page

Home greets them by name with the date, then:
- **At the top, things that need an answer:** for leaders, **N items waiting on
  you**; "Would you be willing to accept this assignment?"; "Can you take this
  assignment?"; "Will you teach?"; "Can you conduct?"; visit invitations; "Which
  organizations are you in?" (new members); and **Turn on notifications**.
- **Then their sections:** Your assignments, Conducting this Sunday (presidency),
  This Sunday's lesson for each organization (Sunday School's is "Come, Follow Me
  this week"), Coming up (the next 45 days, up to 8 items in date order:
  events from their organizations and the ward mixed with their own dated
  assignments, to-dos, Sundays they teach and service they signed up for; long
  events as "Now through …"), Challenge, Ways to
  serve (up to 4 open opportunities), Would you like a visit?, and Church apps. A
  section with nothing in it doesn't show.

Everything comes from **every organization they belong to** (and the ward), not
only the one they're looking at; tapping opens it in its organization.

**Customize Home** (the link at the bottom of Home, or More → Customize Home): each
member puts the sections in their own order with ↑ / ↓ and **Hide** or **Show**
them. It's saved to their account (same on phone and computer); **Reset to the
usual order** puts it back. The answer cards always stay at the top, and hidden
sections are still on their tabs and under More.

## The phone app

The iPhone and Android app does everything the website does, plus:
- **Face ID lock:** More → Privacy → **Lock with Face ID** (or Touch ID,
  fingerprint or passcode). It asks when the app opens and after a minute in the
  background.
- **Home-screen widget:** this Sunday's lesson, this week's Come, Follow Me
  reading, the next event (up to 3 on the large size) and unread messages and
  alerts. iPhone: small, medium, large and lock screen; Android: long-press the
  home screen → Widgets → My Ward Link. It refreshes about every 30 minutes and
  when the app opens.
- A number on the app icon for unread messages and alerts; notifications that open
  the right page; links in emails that open in the app; texted sign-in codes
  offered above the keyboard; Zoom, Meet and Teams links that open their apps;
  **Share…** with the phone's share sheet; press and hold a QR code to save it;
  pull to refresh.

## Privacy and automatic clean-up

The app keeps names, phone numbers and emails, and what members choose to post,
and deletes old information automatically:

| What | Deleted |
|---|---|
| Service opportunities (with sign-ups and guests) | 30 days after the date (180 days after it was made, if no date) |
| RSVPs and event requests | 30 days after the event |
| Offers to teach, "Will you teach?" requests, "can't teach" reasons | 30 days after the lesson |
| Teacher notes and lesson comments | 6 months after the lesson |
| Comments marked "Don't post" | after 30 days |
| Visit requests | 30 days after they're finished (6 months at most) |
| Planned visits never recorded | 30 days after their date |
| Conversations with the presidency | after 6 months |
| Announcements and group messages | after 1 year |
| Reminders & alerts (and delivery records) | after 30 days |
| Private to-dos | 6 months after they're done |
| Challenge entries | no longer tied to anyone 30 days after it ends |
| Old join requests nobody answered | after 60 days |
| Unused sign-in and confirmation codes | after a day |
| Member accounts | 12 months after their last sign-in (or after being added, if they never signed in); leaders are kept |

Recorded home visits stay until the member's account is deleted.

**Deleting an account:** members can delete their own under **More → Delete my
account** (type DELETE). It removes their name, contact info, comments, sign-ups,
RSVPs and everything they posted, and any visit records about them; things they
created as a leader stay without their name. It's refused for the only presidency
member of an organization ("Give someone else presidency access first"). They can
join again later. Leaders remove people from Admin → Members (see **Members joining
and the member list**).

## Site owner

**Admin → Site owner** (site owner only):
- **Who has site-owner access.**
- **New wards to approve:** each with its stake, who started it (with their email or
  phone) and their note. **Approve** opens it and emails them. **Decline** (optional
  note, then **Decline and delete**) deletes the ward, and the starter's account if
  they're in no other ward, and emails them.
- **Each ward's card:** texting status, people and organizations, texts this month
  and their cost, and:
  - **Manage this ward:** join its bishopric so you can manage it.
  - **Texting & billing:** turn texting on or off; set its monthly limit (0 to
    100,000); set a **Paid through** date (texting turns off by itself the day
    after; you're notified two weeks before and when it does); see texts and cost
    for each of the last 12 months at the **Texting cost** per text you set
    ($0.012 to start); or **No texting at all** (nothing is texted, not even
    sign-in codes; it warns how many people sign in with only a phone). **Allow
    texting again** undoes it.
  - **Clear…:** tick Messages and alerts, Calendar and/or Service and type the ward's
    name, to clear test data before going live. Plans, lessons, assignments and
    people stay; presidency meetings stay. It can't be undone (except from a
    backup).
  - **Delete…:** type the ward's name. Deletes its organizations, lessons, calendar
    and messages, and people in no other ward. You can't delete your only ward.
- **Email and texting:** whether email and Twilio are connected, **when email last
  went out and the last failure** (with the error, e.g. a bad Gmail app password),
  the address links point to, and the Twilio incoming-message webhook. **Send me a
  test email** and **Send me a test text** (needs your phone and text consent).
- **Incoming texts:** the last 25 (in 30 days) and where each went: saved as a
  message, asked which organization, a teaching reply, an unknown number, opted
  out. Only where it went is kept, not the words.
- **Come, Follow Me schedule:** once a year, **Load the schedule** for the year (it
  reads the manual from churchofjesuschrist.org). If that doesn't work, open the
  manual in Gospel Library, copy its list of lessons, paste it in the box and load
  again. Check **See every week** afterwards. Loading again updates lessons except
  ones you changed; **Remove** a year (lessons already filled stay).
- **App Store review:** **Set up the demo ward** / **Start it over**, for Apple's
  and Google's reviewers (with `REVIEW_LOGIN` on the server).
- **Start a ward for someone:** ward name, time zone, the bishop's (or clerk's) name
  and email, and texting (off for now, on, or none at all). **Add ward and email
  them** sends them a sign-in link.
- **Contact email:** the Privacy and Terms pages list `CONTACT_EMAIL` (a server setting) for questions, or the address the app sends email from.
- **Backup:** the app copies everything every night (the last 30 are kept).
  **Download a backup** gives one file with every ward, member and uploaded file;
  it holds private information, so keep it safe. **Restore a backup** (a .tar or
  .db file, then type RESTORE) replaces everything on the server, and everyone
  signs in again. A red warning shows if the server has no permanent disk.
