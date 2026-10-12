# Setting up the app on the Windows computer

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

## 4. Download the app

1. Install **Git for Windows** from <https://git-scm.com/download/win> (default options).
2. Open **PowerShell** and run:

```powershell
cd $HOME
git clone https://github.com/keslerco253/Elders-Quorum.git
cd Elders-Quorum
```

Sign in to GitHub if asked.

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

## Backups

Every night after 2 AM a copy of the database is saved to the `backups` folder
inside `Elders-Quorum` (the last 30 days are kept, plus uploaded PDFs).
Once a month, copy that folder to a USB drive or OneDrive.

### Restoring a backup

```powershell
docker compose down
docker run --rm -v elders-quorum-data:/data -v ${PWD}/backups:/backups alpine sh -c "cp /backups/app-2026-10-10.db /data/app.db && rm -f /data/app.db-wal /data/app.db-shm && mkdir -p /data/uploads && cp -r /backups/uploads/. /data/uploads/"
docker compose up -d
```

(Change the date to the backup you want.)

## Updating the app

```powershell
cd $HOME\Elders-Quorum
git pull
docker compose up -d --build
```

## Troubleshooting

| Problem | Fix |
|---|---|
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
