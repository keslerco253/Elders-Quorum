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
- **Joining:** everyone joins a ward with its **join code** (Admin → Settings
  while looking at the ward). Then each person chooses, under **More → My
  organizations**, which organizations they belong to and which they get
  notifications from. Leaders can also add someone from Admin → Members.
- **Setting someone's organizations for them:** Admin → Members → their name
  → **Organizations**. The bishopric (looking at the ward) can tick any
  organization; a presidency can tick its own. Leaders of an organization
  can't be unticked there; change their access level in that organization.
- **Starting another ward (bishopric):** switch to the ward, then Admin →
  Settings → Another ward → Start a new ward.
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
  shouldn't see. Choose a reminder (default: the day before). Check **Ask people
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

**Message groups** (Admin → Send a message → Manage groups): when you create
one, choose its organization (if you lead more than one) and **who can see it
and send to it**: the presidency and/or the people in the group. When
people in the group can send, they get a **Message a group** box on their
Messages tab; their message goes to the rest of the group, signed with their
name, and replies come to the presidency. The presidency can always change a
group.

**Admin → Send a message**: choose Everyone, Presidency, Upcoming
teachers, or a custom group (**Manage groups**; each group's page has
**Send a message to this group**). Members get a push
notification; anyone without notifications turned on gets an email.
Check "Also email members who haven't signed in yet" to reach everyone on the
list.

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
  **Yes, that works**, **That time doesn't work** (with a better time), or
  **Not right now**, from the notification, email, text link or a card on their
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

- **Two people at once:** if someone else's message arrives within 2 minutes
  before your reply (and others wrote in the last 15 minutes), the app holds
  your reply and texts "Who is this for? Reply 1 for … or 2 for …", listing
  everyone who wrote in those 15 minutes. Answer with the number and it goes
  to that person.
- **Pick the person yourself:** start your reply with their name and a comma,
  e.g. "Hyrum, see you at 7" (first name is enough if it's unique among people
  who wrote to you recently). A colon works too ("Hyrum: see you at 7") and
  leaves the name off the message.

**Site owner:** More → Site owner → **Incoming texts** lists the last month's
incoming texts and where each one went (an answer to whom, a message to the
presidency, a teaching reply, an unknown number).

**When a member texts back** to anything you sent them, their reply is saved
in their conversation (Admin → Replies) and the presidency (or the one person
they were writing with privately) is texted or notified with it.

Every message you send under **Admin → Send a message** also shows in each
member's **More → Messages**, with a **Reply** button. Members can reply there,
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
