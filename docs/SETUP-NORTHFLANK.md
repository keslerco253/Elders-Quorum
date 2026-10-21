# Moving the app to Northflank (mywardlink.net)

This moves the app off the home PC onto Northflank, at its own permanent
address **https://mywardlink.net**. Everyone's accounts, lessons, calendar,
messages and uploaded PDFs come along. Members sign in once more and re-add the
app to their Home Screen.

Plan about an hour, ideally on a weeknight evening. Steps 1–4 can be done any
time beforehand; steps 5–9 are the switch-over and take about 15 minutes.

You'll need:
- Your Northflank login, and your GitHub login (keslerco253).
- Your domain registrar login (where you bought mywardlink.net).
- Your current settings: double-click **OPEN-SETTINGS.bat** on the PC to see them.
  Don't screenshot or share that file.

---

## 1. Update the PC to this version

Unzip this version and run **UPDATE.bat** on the PC as usual. That adds
**Admin → Settings → Backup → Download a backup**, which you'll use in step 6.

## 2. Create the service on Northflank

1. In Northflank, create a **project** (e.g. `wardlink`), region **US** (any US region).
2. In the project, **Create new → Service → Combined service** (builds and runs from GitHub).
3. **Repository:** connect GitHub if asked, then choose `keslerco253/elders-quorum`, branch **main**.
4. **Build type:** **Dockerfile**. Dockerfile location `/Dockerfile`, build context `/`.
5. **Build arguments:** add `APP_URL` = `https://mywardlink.net`
6. **Resources:** the smallest plan is enough (0.2 vCPU / 512 MB is fine). **Instances: 1** — never more than one.
7. **Networking / Ports:** port **3000**, protocol **HTTP**, **Publicly expose** turned on.
8. **Environment variables** (runtime variables). Copy the values from your current settings file:

   | Name | Value |
   |---|---|
   | `APP_URL` | `https://mywardlink.net` |
   | `SMTP_USER` | same as now |
   | `SMTP_PASS` | same as now (the Gmail app password) |
   | `MAIL_FROM_NAME` | same as now |
   | `OWNER_EMAIL` | your email (the site owner: every ward, texting, backups) |
   | `SETUP_CODE` | optional: a phrase for restoring a backup onto an empty server |
   | `TWILIO_ACCOUNT_SID` | same as now |
   | `TWILIO_AUTH_TOKEN` | same as now |
   | `TWILIO_FROM` | `+12083579951` |

   Leave out `APP_PORT`, `SMS_PENDING` and `CLOUDFLARE_TUNNEL_TOKEN`; they're only for the PC.
   If Northflank offers to mark a variable as secret, do that for `SMTP_PASS` and `TWILIO_AUTH_TOKEN`.
9. Create the service. The first build takes 5–10 minutes.

## 3. Give it a disk (volume)

Without this, everything would be wiped each time the app restarts.

1. Open the service → **Volumes** → **Add volume**.
2. Name `data`, size **2 GB** (plenty), **mount path `/data`**.
3. Save, then make sure it's **attached to the service**: the volume's page
   must say "Attached to 1 resource", not 0. If it says 0, click **Attach** at
   the top right of the volume's page and choose the service. The service
   restarts with the volume attached.

If Northflank asks for a payment method here, add it: a single small service
with a small volume costs a few dollars a month.

Also under the service: **Health checks → Add** → type **HTTP**, port **3000**,
path **`/api/health`**. (Optional, but it lets Northflank restart the app if it ever hangs.)

## 4. Point mywardlink.net at it

1. In Northflank, go to your team/account **Settings → Domains → Add domain** and enter `mywardlink.net`.
   Northflank shows a **TXT record** to prove you own it.
2. At your registrar's **DNS** page for mywardlink.net, add that TXT record exactly as shown. Back in Northflank, click **Verify** (can take a few minutes, sometimes an hour).
3. Under the verified domain, add the domain itself (the bare `mywardlink.net`, sometimes shown as `@` or "root") and, if you like, `www` too. Northflank shows the DNS record each one needs.
4. At your registrar, add the records Northflank shows:
   - For the bare domain (host `@`): use the record type Northflank says. If it gives a **CNAME** target, your registrar must allow a CNAME-style record on `@` — look for **ALIAS**, **ANAME** or "CNAME flattening". Cloudflare, Namecheap, Porkbun and DNSimple do; GoDaddy and some others don't.
   - For `www` (optional): a **CNAME**, host `www`, value = the target shown.
   - If your registrar can't do it, send me a screenshot of its DNS page. The usual fix is to move the domain's DNS to Cloudflare (free); the domain itself stays where it is.
5. Back in Northflank, link `mywardlink.net` (and `www` if you added it) to your service's port **3000** (in the domain's page, or the service's **Networking** section). Northflank sets up the https certificate itself.

**Other domains (mywardlink.com):** add `mywardlink.com` (and `www.mywardlink.com`) the
same way: verify it, add its records at its registrar, and link it to the same service's
port 3000. The app sends every page there to the same page on mywardlink.net
(`OTHER_DOMAINS`, default `mywardlink.com`; list more separated by commas). Or skip
Northflank and use your registrar's **URL forwarding** (301, keep the path) to
`https://mywardlink.net`.

**Check:** open https://mywardlink.net on your phone. You should see
**First-time setup**. **Don't fill in the setup form** — you'll restore instead.

---

## Switch-over (steps 5–9, same evening)

## 5. Tell the presidency

Ask them not to change anything in the app for the next 15 minutes (anything
changed on the old app after step 6 won't come across).

## 6. Download a backup from the old app

On the PC's app (https://marks-pc.tail8cae59.ts.net), signed in as yourself:
**Admin → Settings → Backup → Download a backup**. A file like
`eq-app-backup-2026-10-20-1930.tar` downloads. It holds members' private
information — delete it from Downloads when you're done.

## 7. Restore it on the new app

1. Open https://mywardlink.net/setup
2. Tap **Moving from another server? Restore a backup**.
3. Enter the **SETUP_CODE** from step 2, choose the backup file, tap **Restore backup**.
4. You'll see "Backup restored: … members". Sign in with your email as usual.
5. Check a few things: members, upcoming lessons, the calendar.

## 8. Point the old address at the new one

On the PC, double-click **OPEN-SETTINGS.bat**, add this line, save, then run **UPDATE.bat**:

```
MOVED_TO=https://mywardlink.net
```

From now on, anyone who opens the old address — the old Home Screen icon, an
old text or email link — lands on the same page at the new address. The PC
also stops sending reminders and texts, so nothing is sent twice.

**Leave the PC running for about a month** so those old links keep working.
After that you can turn it off for good (keep a copy of
`%USERPROFILE%\EldersQuorumApp\backups` somewhere safe, then delete it).

## 9. Twilio

1. **Reply webhook:** in Twilio, open your Messaging Service (where you set the
   webhook before) and change the incoming-message URL to
   `https://mywardlink.net/api/sms/inbound` (HTTP POST). Save.
2. **Test:** in the new app, **Admin → Site owner → Send me a test text**, then reply to it and check **Admin → Replies**.
3. **Campaign links:** your approved texting campaign lists the privacy and
   terms pages at the old address. Open a ticket with Twilio Support (Help →
   Support → Create ticket) asking to update the campaign's links to:
   - Privacy policy: `https://mywardlink.net/privacy`
   - Terms: `https://mywardlink.net/terms`
   - Opt-in / sign-up page: `https://mywardlink.net/join`

   Until it's done the old links still work, thanks to step 8.

---

## 10. Tell the quorum

Send this from **Admin → Messages** (push notifications still reach phones set
up on the old address, and tapping it opens the new one):

> **The quorum app has a new address: mywardlink.net**
> 1. Tap this message (or open mywardlink.net in Safari/Chrome) and sign in.
> 2. Add it to your Home Screen again (Share → Add to Home Screen on iPhone), and delete the old icon.
> 3. Open it from the new icon and turn on notifications under More.
> 4. If you subscribed to the quorum calendar, subscribe again under Calendar → Subscribe, and remove the old one.

Members who turn notifications on at the new address automatically stop
getting them through the old icon.

## Backups on Northflank

The app still makes a nightly backup, but on Northflank it's kept on the same
disk as the app. Once a month (and before any big change), download one from
**Admin → Site owner → Backup** and keep it somewhere safe (not shared).

## Updating the app later

There's no more UPDATE.bat: Northflank rebuilds and restarts the app by
itself whenever a new version is pushed to the `main` branch on GitHub.

## If something goes wrong

- **Restore says the server is already set up:** someone filled in the setup
  form. In Northflank, delete the volume, add a new one (step 3), and restore again.
- **"Add a SETUP_CODE setting":** add `SETUP_CODE` to the service's environment variables (step 2.8) and try again.
- **Going back to the PC:** remove the `MOVED_TO` line in OPEN-SETTINGS.bat and run UPDATE.bat. Change the Twilio webhook back.
