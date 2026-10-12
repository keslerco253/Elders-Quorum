# Villas Ward Elders Quorum App

A private web app for our elders quorum. Members install it on their phone's
home screen (it's a PWA), and it also works in any browser on a computer.

**For members:** weekly lessons with talk links and a comment section, the
quorum calendar with "Add to my calendar", the Temple & Family History and Ward
Mission plans, sign-ups, push notifications, and quick links to Gospel Library
and Member Tools.

**For the presidency and admins:** comment approval, teacher assignments,
events and event requests, group messages, join codes and join requests,
presidency home-visit records, presidency assignments, and support for more
than one ward.

**Privacy:** the app never imports Church membership records. Members join
themselves and only their name, email and what they post are kept; old
information is deleted automatically and members can delete their account at
any time. See [Privacy summary](docs/PRIVACY-SUMMARY.md).

## Install

On the Windows computer: read `START-HERE.txt`, then double-click `INSTALL.bat`.

## Guides

| Guide | For |
|---|---|
| [Windows setup](docs/SETUP-WINDOWS.md) | Installing and running the app on the home computer |
| [Presidency guide](docs/PRESIDENCY-GUIDE.md) | Day-to-day use: lessons, approvals, messages, visits |
| [Handoff guide](docs/HANDOFF.md) | Passing the app to the next presidency |
| [Requirements](docs/requirements.md) | What the app was built to do |

## Access levels

| | Member | Admin (bishop, high councilor) | Presidency |
|---|:-:|:-:|:-:|
| Lessons, comments, calendar, plans, sign-ups | ✓ | ✓ | ✓ |
| Approve comments, post lessons/plans/events, send messages, see who joined | | ✓ | ✓ |
| Home visits, assignments, assign teachers, approve access, change roles, settings | | | ✓ |

## For developers

Next.js 15 (App Router, server actions), TypeScript, SQLite (better-sqlite3),
Tailwind CSS 4, web-push, nodemailer. Everything runs in one process; a
built-in scheduler sends reminders and makes nightly backups.

```bash
npm install
npm run dev                         # http://localhost:3000 (data in ./data)
npm run seed -- --email you@x.com   # demo data in an empty database
npm test                            # unit tests
npm run lint && npm run typecheck
```

Without SMTP settings, emails (including sign-in codes) are written to
`data/outbox/` instead of being sent.

```
src/app/(public)    sign-in, access requests, first-time setup
src/app/(app)       member pages (home, lessons, calendar, plans, sign-ups, more)
src/app/(app)/admin admin and presidency pages
src/lib             database, auth, notifications, scheduler, helpers
src/lib/db/migrations.ts   database schema (add new migrations at the end)
```
