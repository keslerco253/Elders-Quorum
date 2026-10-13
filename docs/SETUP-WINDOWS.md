# Setting up the app on the Windows computer

**Quick way:** follow `START-HERE.txt`. It covers getting the computer ready,
then **INSTALL.bat** does the rest: it checks Docker and Tailscale, asks for
the Gmail app password, writes the settings file, builds and starts the app,
turns on the public address, and opens the app.

The rest of this guide explains each step, how to do it by hand, backups,
updates and troubleshooting.

---

Plan for about an hour the first time. You only do this once.

What you'll end up with:
- The app running on the home computer, restarting by itself after reboots.
- A free, secure web address like `https://villas-eq.tail1234.ts.net` that
  members open on their phones.
- A nightly backup in a folder you can see.

---

## 1. Get the computer ready

1. Plug it in and set it to **never sleep**: **Settings → System → Power** →
   set "When plugged in, put my device to sleep after" to **Never**.
2. Set **Windows Update** active hours so restarts happen overnight.

## 2. Create a Gmail app password

The app sends sign-in emails from `villaseldersquorum@gmail.com`.

1. Sign in to that account at <https://myaccount.google.com>.
2. **Security → 2-Step Verification**: turn it on (required for app passwords).
3. Go to <https://myaccount.google.com/apppasswords>, create one named
   "Elders Quorum App", and copy the 16-letter password. You'll need it in
   step 6.

## 3. Install Docker Desktop

1. Download from <https://www.docker.com/products/docker-desktop/> and install
   (accept the WSL 2 option). Restart when asked.
2. Open Docker Desktop → **Settings → General** → check **Start Docker Desktop
   when you sign in to your computer**.
3. Set Windows to sign in automatically after a restart, or make sure someone
   signs in after power outages. Docker only runs after sign-in.

## 4. Get the app

Either unzip the package you were given into a permanent folder (for example
`Documents\Elders-Quorum`), or, to make updates easier, install **Git for
Windows** (<https://git-scm.com/download/win>) and in PowerShell run:

```powershell
cd $HOME
git clone -b main https://github.com/keslerco253/Elders-Quorum.git
cd Elders-Quorum
```

Sign in to GitHub if asked. With Git, **UPDATE.bat** downloads new versions by
itself.

## 5. Get the public web address (Tailscale Funnel, free)

Tailscale gives the computer a free, permanent HTTPS address without opening
anything on your router.

1. Install Tailscale from <https://tailscale.com/download/windows> and sign in
   (a Google sign-in with the quorum Gmail is easiest to hand off later).
2. In the Tailscale admin console (<https://login.tailscale.com/admin/machines>),
   rename this computer to something short, like `villas-eq`.
3. In PowerShell run:

```powershell
tailscale funnel --bg 3000
```

The first time, it opens a page asking you to enable HTTPS and Funnel. Approve
it, then run the command again. It prints your address, for example
`https://villas-eq.tail1234.ts.net`. Copy it.

> Prefer your own domain name (about $10/year)? See "Optional: Cloudflare" at
> the end of this guide.

## 6. Fill in the settings file

In PowerShell, in the `Elders-Quorum` folder:

```powershell
copy .env.example .env
notepad .env
```

Fill in:
- `APP_URL`: the address from step 5 (no slash at the end)
- `SMTP_PASS`: the app password from step 2 (no spaces)
- `SETUP_CODE`: any phrase. You'll type it once on the setup page so no one
  else can claim the app first.

Save and close.

## 7. Start the app

```powershell
docker compose up -d --build
```

The first build takes a few minutes. When it finishes, open your address from
step 5 in a browser.

## 8. Preview with demo data first (recommended)

Before setting up for real, you can explore the app filled with made-up members,
lessons and events:

```powershell
docker compose exec app node seed.js --email YOUR-EMAIL@gmail.com
```

Open the app, sign in with your email, and you'll be "Daniel Carter", the demo
president. Try everything.

**When you're done reviewing, erase the demo data:**

```powershell
docker compose down
docker volume rm elders-quorum-data
docker compose up -d
```

## 9. Set up for real

1. Open the app address. You'll see **First-time setup**.
2. Enter the setup code, keep the app name "Villas Ward Elders Quorum",
   choose **Mountain – Idaho**, and enter your name and email.
3. Check your email for the sign-in code.
4. **Admin → Settings → Join code → Create a code.**
5. **Admin → Settings → Send me a test email** to confirm email works.
6. Have the counselors, secretary, bishop and high councilor join (with the
   code), then open each of them in **Admin → Members** and set their
   **Access level**.
7. Announce the address and join code in quorum meeting.

The app never imports anything from LCR or Member Tools. Members join
themselves, and only their name and email are kept.

## 10. Install on your phone

- **iPhone:** open the address in **Safari** → Share button → **Add to Home
  Screen**. Open it from the Home Screen, go to **More**, and turn on
  notifications.
- **Android:** open in **Chrome** → the menu → **Install app** (or "Add to Home
  screen"). Turn on notifications under **More**.

When signing in from the installed iPhone app, type the 6-digit code. The email
link opens in Safari, not the app.

---

## Texting (optional)

Members can sign in and get reminders by text instead of (or as well as)
email. Until this is set up, the app works with email only. Expect about $19 to
register once, then roughly $3–8 a month (about 1.3¢ per text, a $1.15 number
and $2 registration upkeep). Admin → Settings → Texting shows this month's count,
and the **monthly text limit** (default 500) caps the bill.

Use a **separate Twilio account for the quorum** (signed up with the quorum
Gmail), not a business account, so texts match who sends them and the account
can be handed to the next president.

1. Create an account at <https://www.twilio.com/try-twilio> with the quorum
   Gmail, turn on two-factor login (User settings), and upgrade it with $20 of
   prepaid credit (a trial account can't register for texting).
2. **Phone Numbers → Buy a number**: pick a local (208) number with SMS.
3. **Messaging → Regulatory Compliance → A2P 10DLC**: register a **Sole
   Proprietor** brand in your own name (Twilio texts a code to your cell), then a
   campaign. Paste these answers:
   - **Use case:** Account notifications / 2FA (one-time passcodes)
   - **Campaign description:** "Sign-in codes and reminders for members of a
     volunteer church quorum group who sign up in our app. Members get a
     one-time code to sign in, and may choose to receive weekly lesson reminders,
     activity reminders and announcements by text."
   - **Sample message 1:** "482913 is your Villas Ward Elders Quorum sign-in code.
     It expires in 20 minutes. Reply STOP to opt out."
   - **Sample message 2:** "Villas Ward Elders Quorum: Tomorrow's lesson: Abide in
     My Love. Tap to read the talk and share your thoughts.
     https://YOUR-ADDRESS/lessons/12"
   - **How users opt in:** "Members join at https://YOUR-ADDRESS/join by
     entering their own mobile number and checking a box that says: 'If I give a
     mobile number, I agree to receive sign-in codes and quorum messages by text.
     Message and data rates may apply. Reply STOP to opt out, HELP for help.'
     Privacy policy: https://YOUR-ADDRESS/privacy"
   - **Opt-out / help keywords:** STOP and HELP (Twilio's defaults).
   (Replace YOUR-ADDRESS with your app address.) When creating the campaign,
   create a Messaging Service, then in **Messaging → Services → (your service)
   → Sender Pool**, add the number you bought. Keep the app running while
   waiting: reviewers may open the Join and Privacy pages.
   **Before submitting**, add `SMS_PENDING=1` to `.env` and run UPDATE.bat, so
   the Join page shows the mobile-number consent wording reviewers check.
4. Wait for approval (usually 1–3 weeks). Twilio emails you.
5. Put these three lines in `.env` (Account SID and Auth Token are on the Twilio
   console home page):
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM=+12085550100
   ```
6. Double-click **UPDATE.bat**. Then add your own number under **More → My
   contact info** and use **Admin → Settings → Send me a test text**.
7. **Let text replies reach the presidency.** In Twilio, go to **Messaging →
   Services → (your service) → Integration**. Under **Incoming Messages**, choose
   **Send a webhook**, set **Request URL** to
   `https://YOUR-ADDRESS/api/sms/inbound` (Admin → Settings shows the exact
   address), method **HTTP POST**, and click **Save**. Text yourself a reply to
   the test text: it should show up under **Admin → Replies**.
   If replies don't appear, check that `APP_URL` in `.env` exactly matches your
   app address; Twilio signs each message with it, and the app ignores
   anything that doesn't match. Texts members send back count toward the
   monthly limit.

The sign-in and join pages then say "Mobile number or email".

## Backups

Every night after 2 AM a copy of the database is saved to the `backups` folder
inside `Elders-Quorum` (the last 30 days are kept, plus uploaded PDFs).
Double-click **BACKUP-NOW.bat** for an extra copy any time. Once a month, copy
that folder to a USB drive or OneDrive.

### Restoring a backup

```powershell
docker compose down
docker run --rm -v elders-quorum-data:/data -v ${PWD}/backups:/backups alpine sh -c "cp /backups/app-2026-10-10.db /data/app.db && rm -f /data/app.db-wal /data/app.db-shm && mkdir -p /data/uploads && cp -r /backups/uploads/. /data/uploads/"
docker compose up -d
```

(Change the date to the backup you want.)

## Updating the app

Double-click **UPDATE.bat**. With a Git copy it downloads the newest version;
with a zip copy, unzip the new version over the folder first (keep `.env` and
`backups`). Your data is kept either way.

If you change `APP_URL` in `.env`, run UPDATE.bat (the address is built into
the app).

## Troubleshooting

| Problem | Fix |
|---|---|
| Installer says the app "isn't answering" | Another program may be using port 3000. Run INSTALL.bat again: it now detects this, picks a free port and saves it as `APP_PORT` in `.env`. To see who uses the port: `Get-NetTCPConnection -State Listen -LocalPort 3000` in PowerShell. |
| Site doesn't load | Is Docker Desktop running? Run `docker compose ps`. Run `tailscale funnel status` to check the address. |
| No sign-in emails | Admin → Settings → Send me a test email. Check `SMTP_USER`/`SMTP_PASS` in `.env`, then `docker compose up -d`. |
| See what the app is doing | `docker compose logs -f app` |
| Changed `.env` | `docker compose up -d` (restarts with new settings) |

## Optional: Cloudflare instead of Tailscale

If you buy a domain (for example through Cloudflare, about $10/year), you can
use a nicer address like `eq.villasward.org`:

1. In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a
   tunnel** (Cloudflared). Copy the token.
2. Add a public hostname pointing to `http://app:3000`.
3. Put the token in `.env` as `CLOUDFLARE_TUNNEL_TOKEN`, set `APP_URL` to your
   new address, then run `docker compose --profile cloudflare up -d`.
