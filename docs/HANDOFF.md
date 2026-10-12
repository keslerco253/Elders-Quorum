# Handing off the app

When the presidency changes, here is everything the next person needs.

## Accounts to transfer

| Account | What it's for | How to hand off |
|---|---|---|
| `villaseldersquorum@gmail.com` | Sends sign-in emails; owns Tailscale | Give the new president the password and 2-step verification phone, or add their phone |
| Tailscale (signed in with the Gmail above) | The public web address | Comes with the Gmail account |
| GitHub repository `keslerco253/Elders-Quorum` | The app's code and updates | Add the new person as a collaborator, or transfer the repository |
| The home computer | Runs the app | See "Moving to a new computer" if it changes |

Keep the `.env` file. It has the app password and settings.

## In the app

1. Sign in as presidency → **Admin → Members**.
2. Set the new presidency members' **Access level** to Presidency.
3. Change released members back to Member.
4. The **site owner** (who can add wards) is whoever did the first-time setup.
   To pass that role on, a developer can run
   `UPDATE members SET is_site_owner = 1 WHERE email = 'new@email.com'`
   on the database. Day-to-day use doesn't need it.

## Moving to a new computer

1. On the old computer, make sure last night's backup is in `backups`, or make
   a fresh one: `docker compose exec app node -e "require('better-sqlite3')('/data/app.db').backup('/backups/app-move.db')"`.
2. Copy the whole `Elders-Quorum` folder (including `.env` and `backups`) to the
   new computer.
3. On the new computer, follow [Windows setup](SETUP-WINDOWS.md) steps 1, 3 and
   5, then restore the backup (see "Restoring a backup" in that guide) and run
   `docker compose up -d --build`.
4. If the Tailscale machine name changes, update `APP_URL` in `.env`.
   Members' installed app may need re-adding to the home screen if the address
   changes.

## Where things live

- **Live data:** Docker volume `elders-quorum-data` (database, uploaded PDFs).
- **Backups:** `Elders-Quorum\backups` (nightly, last 30 days).
- **Settings:** `Elders-Quorum\.env`.
- **Code:** GitHub, and the `Elders-Quorum` folder.
