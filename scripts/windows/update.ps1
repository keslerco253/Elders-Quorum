# Rebuilds and restarts the app with the newest code. Run it with UPDATE.bat.
. (Join-Path $PSScriptRoot "common.ps1")

if (-not (Test-Docker)) { Fail "Docker Desktop isn't running. Open it, wait for 'Engine running', then try again." }
if (Test-Path (Join-Path $Root ".git")) {
  Step "Downloading the newest version"
  git pull
  if ($LASTEXITCODE -ne 0) { Fail "Couldn't download the update. Check the internet connection and try again." }
} else {
  Say "This folder came from a zip file, so it can't download updates by itself." "Yellow"
  Say "Unzip the new version over this folder (keep .env and the backups folder), then run UPDATE.bat again."
}
Step "Rebuilding and restarting (your data is kept)"
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Show-Diagnostics (Get-AppPort); Fail "The update didn't start. Copy the messages above for whoever helps you with the app." }
$port = Get-AppPort
if (Wait-ForApp $port 240) { Say "Updated and running." "Green" } else { Show-Diagnostics $port; Fail "The app isn't answering. Send the diagnostics above to whoever helps you with the app." }
Read-Host "Press Enter to close"
