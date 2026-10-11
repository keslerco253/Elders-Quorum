# Villas Ward Elders Quorum App: Requirements

Status: requirements complete; awaiting approval of the build plan.
The president reviews the whole first version before launch. Nothing is shown to members without the president's approval.

## Platform & Hosting
- Progressive Web App (PWA): works on phones (installs to the home screen) and on computers.
- Push notifications. No text messaging for now (may return later).
- Self-hosted on a computer at home, packaged as a Docker container,
  reached through a free Cloudflare Tunnel (no router ports opened). Free domain is fine.
- Outgoing email (login links, notices) sent from villaseldersquorum@gmail.com (Gmail app password).
- Time zone: Mountain, Idaho (America/Boise), editable in settings.
- Host computer: Windows (Docker Desktop with WSL2; set to never sleep).
- Plan for an easy handoff to future presidencies.
- Multi-ward: one installation, each ward has its own separate space and admins.
- Timeline: ASAP.

## Branding
- App name: "Villas Ward Elders Quorum", editable by admins.
- Church-inspired palette (navy, lighter blue, white, warm grays). No Church logos or trademarks.
- Simple original icon.
- Light and dark mode.

## Roles & Access
- **Presidency** (president, counselors, secretary): everything, including home visits.
- **Admin** (bishop, high councilor): admin tools, but **not** home visits.
- **Member:** everyone else in the quorum.
- Members see: plans, lessons, calendar, comments. No member directory.
- Presidency and admins see a member directory (name, address, phone, email).
- Login: email magic link; user picks how long to stay signed in.
  Members with no email in LCR: an admin adds one by hand (phone login would need texting; deferred).
- Anyone whose email is on the imported membership list can self-register.
  Everyone else submits an access request. All presidency members are notified and any one can approve.
- All quorum members get access regardless of activity. Part-member families: presidency discretion.

## Membership Import
- CSV exported from LCR, uploaded by an admin. Adds new members and updates existing ones.
- LCR columns: Name, Gender, Age, Birth Date, Address, Phone Number, E-mail.
- Imported: Name, Address, Phone Number, E-mail. Gender, Age and Birth Date are ignored
  (not needed; minimizes stored personal data).

## Presidency Home Visits (presidency only)
- Fields: member visited, date, who visited, type (in home, at church, phone, text), notes, follow-up needed.
- Notes are shown with a policy reminder: "Record nothing you would not
  normally text to another presidency member. Follow Church guidelines on member privacy."
- No ministering assignments, interviews or records (kept in LCR).

## Plans
- Temple & Family History plan and Ward Mission plan, posted by admins, readable by members.
- Format: rich text written in the app, with an optional PDF attachment. Older versions are kept.

## Lessons
- Elders quorum meets **every Sunday**; one lesson per Sunday.
- About 6 months of lessons posted right after General Conference.
- Each lesson: date, one assigned talk (link to Gospel Library), assigned teacher.
- Instead of a talk, presidency can mark a Sunday as General Conference or Stake Conference.
  Those Sundays show in the list with no teacher or comments; reminders announce the conference instead.
- Members scroll the list and open any lesson to study ahead.
- Members can volunteer to teach; several may volunteer for the same lesson.
  A presidency member picks and assigns the teacher.
- Comments:
  - Visible to all logged-in users, shown with the commenter's full name.
  - Threaded replies.
  - Comments and replies need presidency/admin approval; admins are notified of pending comments.
  - Commenters are not notified of approvals or replies.
- No notification when lessons are posted. Reminders for the upcoming Sunday's lesson:
  Sunday 7:00 PM and Saturday 8:00 AM (Mountain).

## Calendar
- Only admins create events.
- Members can submit event requests (title, date & time, location, description, notes).
  The requester is notified when the request is approved or declined.
- Per-event "Add to my calendar" (Google, Apple, Outlook).
- Presidency-only events are hidden from members.
- Automatic reminder the day before by default; admins can change it per event.
- Optional RSVP, which admins turn on per event.

## Notifications & Group Messaging
- Admin only. Push notifications to: everyone, admins, presidency, upcoming teachers, or custom groups.
- Members without push enabled (for example, iPhone users who haven't installed the app) get the same messages by email.

## Extras
- Teaching schedule and sign-ups (part of Lessons).
- Service project and meal sign-ups: created by admins only; each sign-up sets its own number of slots.
- Presidency assignments and to-dos: assigned to a person, with a due date and reminders.
- No member photos. No printable reports.
