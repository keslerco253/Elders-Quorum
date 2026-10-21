# Handing off the app

When the presidency changes, here is everything the next person needs.

## Accounts to transfer

| Account | What it's for | How to hand off |
|---|---|---|
| `villaseldersquorum@gmail.com` | Sends sign-in emails; owns Tailscale | Give the new president the password and 2-step verification phone, or add their phone |
| Tailscale (signed in with the Gmail above) | The public web address | Comes with the Gmail account |
| GitHub repository `keslerco253/Elders-Quorum` | The app's code and updates | Add the new person as a collaborator, or transfer the repository |
| The home computer | Runs the app | See "Moving to a new computer" if it changes |

Keep the `EldersQuorumApp` folder in the Windows user folder (`C:\Users\<you>\EldersQuorumApp`). It has the settings file (email password, texting keys) and the backups.

## In the app

1. Sign in as presidency → **Admin → Members**.
2. Set the new presidency members' **Access level** to Presidency.
3. Change released members back to Member.
4. The **site owner** (who can add wards) is whoever did the first-time setup.
   To pass that role on, a developer can run
   `UPDATE members SET is_site_owner = 1 WHERE email = 'new@email.com'`
   on the database. Day-to-day use doesn't need it.

## Moving to a new computer

1. On the old computer, double-click **BACKUP-NOW.bat** for a fresh backup.
2. Copy the `C:\Users\<you>\EldersQuorumApp` folder (settings and backups) to
   the same place on the new computer, plus the newest app zip.
3. On the new computer, follow [Windows setup](SETUP-WINDOWS.md) steps 1, 3 and
   5, restore the backup (see "Restoring a backup" in that guide), then unzip
   the app and run **UPDATE.bat**.
4. If the Tailscale machine name changes, update `APP_URL` with
   **OPEN-SETTINGS.bat** and run UPDATE.bat.
   Members' installed app may need re-adding to the home screen if the address
   changes.

## Moving to a hosted server

To move off a home computer onto Northflank (or another host), see
[Moving to Northflank](SETUP-NORTHFLANK.md): download a backup in
**Admin → Site owner → Backup**, restore it on the new server's setup page, then
set `MOVED_TO` on the old one so old links and Home Screen icons follow.

## The phone app

The iPhone and Android app is in `mobile/` (React Native / Expo, built in the
cloud with EAS). See [The phone app](MOBILE-APP.md) for accounts, building,
store listings and app review.

## Where things live

- **Live data:** Docker volume `elders-quorum-data` (database, uploaded PDFs).
- **Backups:** `C:\Users\<you>\EldersQuorumApp\backups` (nightly, last 30 days).
- **Settings:** `C:\Users\<you>\EldersQuorumApp\settings.env` (open with OPEN-SETTINGS.bat).
- **Code:** GitHub, and whichever folder the newest zip was unzipped into.
