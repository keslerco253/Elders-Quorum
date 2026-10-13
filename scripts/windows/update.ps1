# Installs this version of the app and restarts it. Run it with UPDATE.bat.
# Works from any folder: unzip the new version anywhere and run UPDATE.bat.
. (Join-Path $PSScriptRoot "common.ps1")

if (-not (Test-Docker)) { Fail "Docker Desktop isn't running. Open it, wait for 'Engine running', then try again." }
if (-not (Initialize-Settings)) { Fail "Couldn't find this app's settings. If the app was never installed on this computer, run INSTALL.bat instead." }
if (Test-Path (Join-Path $Root ".git")) {
  Step "Downloading the newest version"
  git pull
  if ($LASTEXITCODE -ne 0) { Fail "Couldn't download the update. Check the internet connection and try again." }
}
Step "Installing this version and restarting (your data is kept)"
Say "From: $Root"
Save-CurrentPort
Remove-OtherCopies
Compose up -d --build
if ($LASTEXITCODE -ne 0) { Show-Diagnostics (Get-AppPort); Fail "The update didn't start. Copy the messages above for whoever helps you with the app." }
$port = Get-AppPort
if (Wait-ForApp $port 240) {
  Say "Updated and running." "Green"
  Say ""
  Say "Your settings and backups are kept in $DataHome,"
  Say "so you can delete folders from older versions you unzipped before."
} else {
  Show-Diagnostics $port
  Fail "The app isn't answering. Send the diagnostics above to whoever helps you with the app."
}
Read-Host "Press Enter to close"
