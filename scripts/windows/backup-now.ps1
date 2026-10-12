# Saves a copy of the database to the backups folder right now. Run with BACKUP-NOW.bat.
. (Join-Path $PSScriptRoot "common.ps1")

if (-not (Test-Docker)) { Fail "Docker Desktop isn't running. Open it and try again." }
$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
docker compose exec -T app node -e "require('better-sqlite3')('/data/app.db').backup('/backups/app-manual-$stamp.db').then(() => console.log('ok'))"
if ($LASTEXITCODE -ne 0) { Fail "The backup didn't work. Is the app running? (docker compose ps)" }
docker compose exec -T app sh -c "mkdir -p /backups/uploads && cp -rn /data/uploads/. /backups/uploads/ 2>/dev/null; true" | Out-Null
Say "Saved backups\app-manual-$stamp.db" "Green"
Say "Copy the backups folder to a USB drive or OneDrive to keep it safe."
Start-Process (Join-Path $Root "backups")
Read-Host "Press Enter to close"
