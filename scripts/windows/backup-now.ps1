# Saves a copy of the database to the backups folder right now. Run with BACKUP-NOW.bat.
. (Join-Path $PSScriptRoot "common.ps1")

if (-not (Test-Docker)) { Fail "Docker Desktop isn't running. Open it and try again." }
if (-not (Initialize-Settings)) { Fail "Couldn't find this app's settings. Run INSTALL.bat first." }
$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
Compose exec -T app node -e "require('better-sqlite3')('/data/app.db').backup('/backups/app-manual-$stamp.db').then(() => console.log('ok'))"
if ($LASTEXITCODE -ne 0) { Fail "The backup didn't work. Is the app running? Try UPDATE.bat, then this again." }
Compose exec -T app sh -c "mkdir -p /backups/uploads && cp -rn /data/uploads/. /backups/uploads/ 2>/dev/null; true" | Out-Null
Say "Saved $BackupDir\app-manual-$stamp.db" "Green"
Say "Copy the backups folder to a USB drive or OneDrive to keep it safe."
Start-Process $BackupDir
Read-Host "Press Enter to close"
