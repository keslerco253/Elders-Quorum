# Presidency guide

Everything below is under **Admin** (top of the screen) unless noted.
A red number on **Admin** means something is waiting for you.

## Who can do what

- **Members** use the app: lessons, calendar, service, messages.
- **Leadership** (each organization's presidency, or the ward's bishopric,
  with its secretaries and clerks) has **Admin** for that organization:
  members, lessons, messages, visits, approvals and settings. Set someone's
  access level under Admin → Members.
- **The site owner** (one person, set by `OWNER_EMAIL` on the server) also
  has **More → Site owner**: every ward, email and texting setup, each ward's
  texting on/off and monthly text limit, backups, and a way back into any ward.

## Wards and organizations

The app holds **wards**, and each ward has **organizations** (Elders Quorum,
Relief Society, Primary, and so on) plus the ward itself, led by the bishopric.

- **Switching:** tap the name at the top left to switch organization (or
  ward). Lessons, sign-ups, messages and admin tools are for the organization
  you're looking at. Everyone in the ward can look at every organization.
- **Leaders are per organization.** Someone's access level (Member or
  Leadership) and calling are set separately in each organization,
  under Admin → Members. Private messages, visits, replies and to-dos stay
  inside their organization: other organizations' leaders, and the bishopric,
  don't see them.
- **Member list:** Admin → Members has **Print** (names, callings, phone and
  email, one clean page) and **Export (Excel)** (a spreadsheet file for Excel,
  Numbers or Google Sheets). Both follow the search and Active/Turned off
  choice. They contain contact info: keep them within leadership.
- **Joining:** everyone joins a ward with its **join code** (Admin → Settings
  while looking at the ward). Then each person chooses, under **More → My
  organizations**, which organizations they belong to and which they get
  notifications from. Leaders can also add someone from Admin → Members.
- **Setting someone's organizations for them:** Admin → Members → their name
  → **Organizations**. The bishopric (looking at the ward) can tick any
  organization; a presidency can tick its own. Leaders of an organization
  can't be unticked there; change their access level in that organization.
- **Starting another ward (bishopric):** switch to the ward, then Admin →
  Settings → Another ward → Start a new ward. Every new ward (from there or
  the website's Start a ward page) is a request: the site owner checks it's
  real, then approves it under Site owner → Ward requests, and the requester
  gets a sign-in link.
- **Members' contact info:** leaders can fix the name, phone or email only for
  someone who hasn't signed in yet. After that, only the member changes it
  (More → Contact & notifications, with a code). Someone already using the app
  in another ward joins yours themselves with your join code.
- **Organizations (bishopric):** every ward comes with Elders Quorum, Relief
  Society, Young Men, Young Women, Primary and Sunday School. Switch to the
  ward, then Admin → Settings → Organizations: **Turn off** the ones you don't
  use (hidden from members, nothing deleted), **Turn on** to bring one back,
  **Delete** to remove one and everything in it for good, or **Add an
  organization** for anything else. Each organization can also turn off
  features it doesn't use.
- **Calendar:** one ward calendar with every organization's events. The chips
  at the top show one organization at a time. "Leaders only" events show only
  to that organization's leaders.
- **Texts** name the ward and organization ("Villas Ward Relief Society:
  ..."). The monthly text limit is for the whole ward and is set by the site owner. A member's texted reply
  goes to the organization that last texted them.
- **Another ward:** someone serving in two wards enters the second ward's join
  code under More → My organizations, then switches between them at the top.

## After each General Conference: set up six months of lessons

1. **Admin → Lessons → 1. Add Sundays**: start date = the Sunday after
   conference, 26 weeks.
2. Tap each Stake Conference and General Conference Sunday in the list and set
   **This Sunday is** to the conference. Those weeks show "no lesson" and
   reminders announce the conference instead.
3. **2. Paste talk links**: in Gospel Library on the web, open each talk you
   chose and copy its address. Paste them all, one per line, in order. They fill
   the open Sundays and the titles and speakers are looked up for you.
4. Open any Sunday to fix a title or swap a talk.

Members get reminders automatically: **Sunday 7 PM** about the next Sunday's
lesson and **Saturday 8 AM** about tomorrow's.

## Teachers

- Members tap **I'd like to teach this** on a lesson. You get a notification.
- **Admin → Lessons**: lessons with volunteers show "2 volunteered". Open the
  lesson and tap **Assign** next to a name, or choose anyone from the list.
- The assigned teacher is notified. Only the presidency can assign teachers.
- **Ask someone to teach:** on a lesson's page in **Admin → Lessons**, choose a
  member, add an optional note and tap **Send request**. They get "Will you
  teach on Sun, Nov 1?" and can answer **Yes, I'll teach** or **I can't** (with
  an optional reason) from the notification, a card on their Home page, the
  lesson page, or by texting **TEACH** / **CANT**. Saying yes assigns them as
  the (already confirmed) teacher and withdraws anyone else you asked. You're
  notified either way; the lesson shows who was asked and their answers, and a
  "no" shows under **Waiting on you → Teacher needed**.
- The teacher gets their own reminder **Sunday at 7 PM** the week before and
  **Saturday at 8 AM** the day before ("You're teaching this Sunday" /
  "You're teaching tomorrow"), with the lesson title and whether their notes
  are posted, waiting for approval, or not added yet. They get this instead of
  the general lesson reminder the rest of the quorum gets at those times.
- The reminders ask the teacher to answer: **I'll be teaching** or **I can't
  teach** (with an optional reason). They can answer with the buttons on the
  notification (Android and computers), by tapping the notification or the
  email's **Reply** button (opens a page that works without signing in), or by
  texting back **TEACH** or **CANT** and a reason. The app texts a short
  thank-you back. You'll see **✓ confirmed** next to the teacher in
  **Admin → Lessons**; after confirming, later reminders just thank them.
- If the teacher can't make it, they tap **I can't teach this lesson** on the
  lesson page and can add a reason (only the presidency sees it). They're taken
  off the lesson, it shows **Teacher needed** again so others can volunteer, and
  the presidency is notified with the reason. It shows under **Waiting on you →
  Teacher needed** until someone is assigned, and the lesson's admin page shows
  who couldn't teach and why.

## Teacher notes

The assigned teacher sees **"You're teaching this lesson: share notes with the
quorum"** on the lesson page. Their notes wait in **Admin → Teacher notes to
approve**. **Approve and share** puts them on the lesson page and sends the quorum a
notification (only the first time for each lesson; later edits are approved
quietly). **Send back to teacher** lets you add a short note; the teacher is
notified and can edit. Notes a leader writes or edits are shared right away. If the teacher
withdraws (or you assign someone else or remove them), the notes they wrote
for that lesson are removed; notes a leader wrote stay.

## Comments

New comments and replies wait in **Admin → Comments to approve**. Tap
**Approve** or **Don't post**. You can also tap **Hide** on any approved comment
from the lesson page.

## Calendar

**Repeating events:** when adding an event, choose **Repeats**: every week,
every 2 weeks, every month on (for example) the third Friday or the last
Friday, or every month on the same date. Choose when it **Ends**: never (dates
are kept filled a year ahead automatically), on a date, or after a number of
times. Each date is its own event, so RSVPs and reminders work per date. When
you edit or delete one, choose **only this date** or **this and all future
dates**. An existing one-time event can be made repeating by editing it.

- **Calendar → Add event.** Check **Presidency only** for meetings members
  shouldn't see. Choose a reminder (default: the day before) and, if you like, a **second reminder** (for example a week before). Attach a **Flyer** (a PDF or picture): it shows on the event's page, with a small preview next to the event on members' home pages. Check **Ask people
  to RSVP** for a headcount.
- Member suggestions show in **Admin → Event requests**. Approving adds the
  event and notifies the member; you can then adjust it.

**Subscribe:** on **Calendar → Subscribe**, members can add the whole quorum
calendar to Apple Calendar, Google Calendar or Outlook once; every event then
appears on its own and stays up to date (calendar apps check every hour or a
few times a day). Each member's link is private; leaders' links
include presidency-only events. **Reset my link** cancels an old link. Members choose up
to two **reminders** (default 1 hour before) that are put on every event in
their calendar. On iPhone they must turn off **Remove Alerts** when
subscribing; Google Calendar ignores them (set reminders in Google instead).

## Messages

**Message groups** (Admin → Message groups): when you create
one, choose its organization (if you lead more than one) and **who can see it
and send to it**: the presidency and/or the people in the group. When
people in the group can send, the group shows up in the **To** list of their
**New message**; their message goes to the rest of the group, signed with their
name, and replies come to the presidency. The presidency can always change a
group.

**Sending anything: Messages → New message.** One button, one **To** field,
like email. Choose **One person…** to write to one member (tick **Private** to keep it
out of the rest of the presidency's view; it opens your conversation with
them), or choose Everyone,
the Presidency, Upcoming teachers, or any message group. If you lead more than
one organization, the choices are grouped by organization. The number next to
each choice is how many people get it. Each group's page also has **Send a
message to this group**, and Admin → Send a message opens the same screen.
Members get a notification, or a text or email as they chose. Everything you
send to a group shows under Messages → **Sent**.

## Members joining

The app never uses Church records. Members join themselves, or the presidency adds them by hand:

- **With the join code** (Admin → Settings → Join code): they're in right away.
  Announce the code in quorum meeting; make a new one if it gets shared
  outside the quorum.
- **Without a code:** their request appears in **Admin → Access requests** for
  the presidency to approve. Declined requests are deleted. Part-member family
  members can be approved at the presidency's discretion.
- **Added by the presidency:** on **Admin → Members → Add a member**, enter
  their name and a mobile number or email. For an email, the app can send them
  an invite. For a phone number, tap **Text invite** to send one from **your
  own phone**: the app never texts a number you typed in until that person
  agrees to texts themselves (carrier rules). The first time they sign in, a
  welcome screen has them confirm their name, agree to what the app keeps, and
  choose whether to get texts. Members marked **No texts** get only the sign-in
  codes they ask for.
- **Admin → Members** lists everyone who joined (name and email only). Open a
  person to change their **Access level**, turn off their access, or delete
  their account.
- For addresses and phone numbers, use Member Tools.

## Phone or email

Members join and sign in with a mobile number **or** an email (phone only after
texting is set up; see the setup guide). Under **More → Contact & notifications**
they can add the other one (confirmed with a code) and choose how they hear from
the quorum, in any combination:

- **Push notifications** on each phone or computer (free).
- **Email every time** and/or **Text every time**, in addition to push.
- **If a notification doesn't reach them** (push off, nothing checked above):
  text, email, both, or nothing. This backup is how everyone worked before.

Everything sent also stays in the app: group messages and replies under
**More → Messages** (a red dot on More means something new), visit replies on
**More → Request a visit**. **Admin → Settings → Texting** shows how many texts
went out this month and sets the monthly limit.

## Privacy and automatic clean-up

The app keeps only name, email and what members choose to post, and deletes
old information automatically:

| What | Deleted |
|---|---|
| Sign-ups, RSVPs, event requests | 30 days after the event |
| Teacher notes | 6 months after the lesson |
| Offers to teach | 30 days after the lesson |
| Lesson comments | 6 months after the lesson |
| Visit requests | 30 days after they're finished (6 months at most) |
| Replies and conversations with the presidency | after 6 months |
| Join requests nobody answered | after 60 days |
| Member accounts not used | after 12 months (leaders are kept) |

Members can delete their own account any time under **More**. Deleting an
account also removes any presidency visit records about that person.

## Home visits (presidency only)

**Upcoming visits** are at the top of **Admin → Home visits**: who, the date
and time, and who's going. A visit gets there two ways:

- **From a request:** on **Admin → Visit requests**, tap **Schedule visit**,
  pick the date, time and who's going. The member is sent the date and time
  ("Brother Smith and Brother Jones plan to visit you Tue, Oct 14 at 7:00 PM").
- **On your own:** **Plan a visit**, choose the member, date and time. Tick
  "Send them the date and time" if you want the app to tell them; leave it off
  if you'll call them yourself.

- **Invite a member:** on their page in **Admin → Members**, tap **Invite to a
  home visit**. Pick the date, time and who's going; a personal message is
  written for you ("We would love to come visit you and your family in your
  home on Tuesday, October 20 at 7:00 PM…") and you can change it. They answer
  **Yes, that works**, **Suggest a different date or time**, or
  **Now is not a convenient time for us**, from the notification, email, text link or a card on their
  Home page. You're notified, and Upcoming visits shows **Invited, waiting**,
  **✓ Confirmed** or **Asked for another time** with their suggestion and a
  **Pick a new time** button that sends an updated invitation.
- **Invitations stay out of Upcoming visits until agreed.** They're listed under
  **Invitations** (waiting for a reply, asked for another time, or would rather
  not). If you settle it by phone or in person, open **Talked with them? Record
  their answer**: **They said yes** (set the agreed date and time; optionally
  send them a confirmation) moves it to Upcoming visits; you can also record
  **They want another time** or **They'd rather not right now**.

Whoever is going gets a reminder the morning of the visit. Afterwards tap
**Record visit** (the form is filled in from the plan); that moves it to the
visit history and closes the member's request. **Change** reschedules it and
**Cancel** removes it (a request goes back to Visit requests). If the member
cancels their request, the planned visit is removed and whoever was going is
told. Planned visits never recorded are deleted 30 days after their date.

**Admin → Home visits → Record a visit.** The **By member** tab shows everyone
and their last home visit, with those never visited at the top. **Follow-ups**
lists visits marked "follow-up needed".

Visits can only be recorded for people who have joined the app. Keep notes
brief: record nothing you wouldn't text to another presidency member, and
never health, financial or worthiness details. Ministering interviews and
assignments stay in LCR.

## Replies (presidency only)

**Messages (your inbox):** tap **Messages** at the top (the speech bubble on a
phone). Leaders see three tabs, and a **New message** button at the top:
- **Inbox**: one row per person who has written to you (and a separate row for
  each private conversation), from every organization you lead, newest first.
  A blue dot and red count mean unread; **Needs reply** means their message is
  the last one. Use **Unread** to see only what's new, and the search box to
  find someone by name.
- **Sent**: announcements sent to everyone, the presidency, teachers or a
  group, with who sent them and how many were reached.
- **My messages**: your own messages as a member, exactly as members see them
  (below), with its own **Inbox** and **Sent**.

**What members see in Messages:** a **New message** button and two tabs, like
a phone's messages app. **Inbox** has one row per conversation (with the whole
presidency, or privately with one leader) and one row per announcement, newest
first, across all their organizations; a blue dot means unread. Tapping a
conversation opens it like a text thread, with the reply box at the bottom.
Tapping an announcement shows it in full with a box to reply to the
presidency. **Sent** lists what they've written, with **Seen** once a leader
has read it. **New message** lets them choose the whole presidency (or
bishopric), one leader privately, or a group that lets members send.

Open a conversation to see the whole back-and-forth. New messages appear on
their own while it's open. Under your last answer it says **Seen** once they've
read it. Links, emails and phone numbers in messages can be tapped. Your
unfinished reply is kept if you leave and come back; **Ctrl+Enter** (⌘+Enter on
a Mac) sends. **Mark as unread** keeps it in your Unread list. Each leader has
their own read and unread: a counselor opening a conversation doesn't mark it
read for you. Notifications from the same person replace each other instead of
piling up, and open at the newest message.

**Personal messages:** to write to one member, open them in **Admin →
Members** → **Send a personal message** (or reply in their conversation under
Admin → Replies). There's no subject. Their text or email is just your words,
signed "- Your Name", with no ward header and no link, and a notification
shows your name. The rest of the presidency can see the conversation;
choose **Private with you** for something only you should see (it reaches
them the same way, but only you see it in the app).

**When a member writes to you,** your text, email and notification carry
their whole message, so you can read it without opening the app. To answer,
**just reply to that text**: it goes to the member (privately if their message
was private), signed with your name, and shows in their conversation under
Admin → Replies. Or answer in the app with the link. A reply goes to the member whose
message came to you most recently (in the last 3 days). Replies to teaching
requests (TEACH / CAN'T) are still handled as teaching answers.

- **More than one person writing:** the app holds your reply and texts "Who
  is this for? Reply 1 for … or 2 for …" when two or more people who wrote in
  the last 3 days are still waiting for an answer, or when someone's message
  arrived in the 2 minutes before your reply while someone else had also
  written in the last 15 minutes. Answer with the number and it goes to that person. Once you've
  answered one, a reply goes to the one still waiting without asking. If you lead in more than one
  ward or organization, everyone waiting on you in any of them is included, and
  your answer goes out from the ward and organization they wrote to.
- **Pick the person yourself:** start your reply with their name and a comma,
  e.g. "Hyrum, see you at 7". A first name is enough; if two people who
  wrote to you have that first name, the app asks which one (or use the full
  name, "Hyrum Johnson, …"). A colon works too ("Hyrum: see you at 7") and
  leaves the name off the message.

**Site owner:** More → Site owner → **Incoming texts** lists the last month's
incoming texts and where each one went (an answer to whom, a message to the
presidency, a teaching reply, an unknown number).

**When a member texts back** to anything you sent them, their reply is saved
in their conversation (Admin → Replies) and the presidency (or the one person
they were writing with privately) is texted or notified with it.

Every announcement you send from **New message** also shows in each
member's Messages inbox, where they can open it and reply. Members can reply there,
or simply text back if they got it by text. Replies go to **Admin → Replies**
(and count in **Waiting on you**), and every presidency member is notified.

Open a conversation to read it and answer. Your answer goes to that member only,
signed with your name, as a notification (or by text/email if they turned
notifications off). Under **Message one person** you can start a private
conversation with any member.

**Private messages.** When writing, members choose **Send to**: the whole
presidency, or **only** one presidency member (for example, the Elders Quorum
President). A private message shows only to that person, under a **Private to
you** label in Replies and a **Private with you** tab in the conversation; the
rest of the presidency can't see it. Notifications for private messages say
"Private message from …" without the words, in case someone else sees the phone
or inbox. If the member texts back after a private reply, their text stays
private too. If that presidency member's account is deleted, their private
conversations are deleted with it rather than shown to anyone else.

Set each presidency member's **Calling** (President, First Counselor, Second
Counselor, Secretary, Assistant Secretary; Stake High Council for that admin) on their page under **Admin → Members**, so members know
who's who when choosing.

Replies are seen only by the presidency, even when the bishop or Stake High Council representative
sent the original message. Replies to emails still go to the quorum Gmail inbox.
Conversations are deleted after 6 months.

## Visit requests (presidency only)

Members can ask for a visit from **Home → Would you like a visit?** or
**More → Request a visit**. They choose a home visit, a chance to talk, or help
with something, and can add their best times and a short note. Every
presidency member is notified (the note itself stays in the app, not in the
notification) and the request shows under **Admin → Waiting on you**.

On **Admin → Visit requests**:

- **Send reply**: a short message to the member, such as when you'll come by.
  The member is notified and the request shows as Scheduled.
- **Mark visited**: closes the request and opens **Record a visit** for that
  member, so you can log it if you'd like.
- **Close**: for requests handled another way.

Members see the status and any reply, and can cancel. Bishops and high
councilors don't see visit requests.

## Assignments (presidency only)

**Admin → Assignments**: add a to-do, assign it to a presidency member with a
due date. Don't put member names or personal details in assignments. They're notified, then reminded at 8 AM the day before and the day
it's due.

## Service

**Service → New service opportunity.** Each line is a slot and how many people are needed:

**Flyer:** on a service opportunity's edit screen, attach a **Flyer** (a PDF or
a picture, up to 15 MB). It shows on the opportunity's page: pictures directly,
PDFs page by page, so members don't have to open anything. Tick **remove** to
take it off, or attach a new one to replace it. A small preview of the flyer shows next
to the opportunity in the Service list and on members' home pages.

**Reminders:** everyone signed up for a service opportunity with a date gets two
reminders (from 8 AM), saying what they signed up for. They're **a week before**
and **the day before** unless you change them on the opportunity's edit screen
(**Reminder** and **Second reminder**: the morning of, 1, 2 or 3 days, 1 or 2
weeks before, or no reminder). Opportunities without a date don't send reminders.

```
Helpers | 6
Bring a trailer | 1
```

For meals, put one line per day with `| 1`.

## Plans

Plans belong to the ward, and the **Plans** tab shows in every organization.
Each plan is for **the whole ward** (it shows everywhere) or for **chosen
organizations**. For example, a youth temple plan for Young Men and Young
Women shows on their Plans tabs and in the ward's list, but not in Elders
Quorum or Relief Society.

- **Building the page:** a plan is built like a web page, from blocks. Use
  **Add: Heading, Text, Pictures or PDFs, Divider** (or drop files onto the
  page, or paste a picture). Pictures show right on the page and PDFs show
  their pages, so nobody has to tap to open them.
  - **Move** a block: drag its ⠿ handle (or use ↑ ↓).
  - **Size** a picture or PDF: drag its blue corner, or tap S, M, L or Full.
  - **Place** it: Left or Right puts text beside it; Center puts it on its
    own line. On phones, wide pictures fill the screen.
  - Text has **B**, *I*, • List and Link buttons; add a caption under any
    picture.
- **Update a plan:** open it → **Update plan**. Each save is kept: the
  **Update history** at the bottom of the edit page lists every save with its
  date, time and who made it, and opens the plan as it was then. Members just
  see the current plan.
- **New plan:** Plans → **New plan**, then choose who it's for.
- **Who can edit:** the bishopric can create and edit any
  plan. An organization's presidency can create and edit plans for
  the organizations they lead.

## Settings

**Admin → Settings** (bishopric, looking at the ward): the ward's name, time
zone, join code, features and organizations, and starting another ward.
Email, texting and backups are on the site owner's page.

## Notifications

Tapping a notification opens the app on the right page. **More → Notifications**
keeps the full text of everything the app sent you for 30 days (a red dot on
More means something unread). On Android and computers notifications stay on
screen until tapped. On iPhone each person can choose that themselves:
**Settings → Notifications → (the app) → Banner Style → Persistent**.

## A member's home page

Each member's home page shows what's coming up in **every organization they
belong to** (and the ward), not only the one they're looking at: next Sunday's
lesson for each organization that has lessons, upcoming events (labeled with
their organization), and service opportunities. Tapping one opens it in its
organization.

**Request a visit** asks members who they'd like to hear from (one of their
organizations' presidencies, or the bishopric). If there's only one choice, it's
picked for them. A member can have one open request with each.

