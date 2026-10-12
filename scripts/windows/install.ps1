# One-time installer for the elders quorum app. Run it with INSTALL.bat.
. (Join-Path $PSScriptRoot "common.ps1")

Say ""
Say "  Elders Quorum App - Installer" "Cyan"
Say "  ------------------------------"
Say "  This sets up the app on this computer. It takes about 10 minutes."
Say ""

# 1. Docker Desktop
Step "Checking Docker Desktop"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Start-Process "https://www.docker.com/products/docker-desktop/"
  Fail "Docker Desktop isn't installed. The download page just opened. Install it, restart the computer, open Docker Desktop once, then run INSTALL.bat again."
}
if (-not (Test-Docker)) {
  Say "Starting Docker Desktop (this can take a minute)..." "Yellow"
  $dd = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (Test-Path $dd) { Start-Process $dd }
  $ok = $false
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 3; if (Test-Docker) { $ok = $true; break } }
  if (-not $ok) { Fail "Docker Desktop isn't running. Open Docker Desktop, wait until it says 'Engine running', then run INSTALL.bat again." }
}
Say "Docker Desktop is running." "Green"

# 2. Tailscale and the public address
Step "Checking Tailscale (gives the app its free web address)"
$ts = Find-Tailscale
if (-not $ts) {
  Start-Process "https://tailscale.com/download/windows"
  Fail "Tailscale isn't installed. The download page just opened. Install it, sign in (use the quorum Gmail account), then run INSTALL.bat again."
}
$status = $null
try { $status = (& $ts status --json | Out-String) | ConvertFrom-Json } catch { }
if (-not $status -or $status.BackendState -ne "Running") {
  Fail "Tailscale isn't signed in. Click the Tailscale icon by the clock, sign in, then run INSTALL.bat again."
}
$dnsName = "$($status.Self.DNSName)".TrimEnd(".")
if (-not $dnsName) { Fail "Couldn't read this computer's Tailscale name. In the Tailscale admin console, turn on MagicDNS and HTTPS, then try again." }
$appUrl = "https://$dnsName"
Say "This computer's address will be: $appUrl" "Green"

# 3. Settings file
Step "Settings"
$envPath = Join-Path $Root ".env"
$existing = Read-EnvFile
if ($existing.Count -gt 0 -and $existing["SMTP_PASS"]) {
  Say "Found existing settings (.env). Keeping them, and updating the web address."
  Set-EnvValue "APP_URL" $appUrl
  $setupCode = $existing["SETUP_CODE"]
} else {
  $gmail = Read-Host "Gmail address that sends sign-in emails [villaseldersquorum@gmail.com]"
  if (-not $gmail) { $gmail = "villaseldersquorum@gmail.com" }
  Say ""
  Say "Next you need a Gmail 'app password' (16 letters)." "Yellow"
  Say "Opening the Google page. Sign in as $gmail, create one named 'Elders Quorum App', and copy it."
  Say "(If Google says app passwords aren't available, turn on 2-Step Verification first.)"
  Start-Process "https://myaccount.google.com/apppasswords"
  $secure = Read-Host "Paste the app password here" -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  $plain = $plain -replace "\s", ""
  if ($plain.Length -lt 16) { Fail "That doesn't look like a 16-letter app password. Run INSTALL.bat again." }
  $name = Read-Host "Name shown on emails [Villas Ward Elders Quorum]"
  if (-not $name) { $name = "Villas Ward Elders Quorum" }
  $setupCode = -join ((48..57) + (65..90) | Get-Random -Count 8 | ForEach-Object { [char]$_ })
  $content = @"
APP_URL=$appUrl
SMTP_USER=$gmail
SMTP_PASS=$plain
MAIL_FROM_NAME=$name
SETUP_CODE=$setupCode
APP_PORT=3000
CLOUDFLARE_TUNNEL_TOKEN=
"@
  Write-Utf8NoBom $envPath (($content -replace "`r", "") + "`n")
  Say "Saved settings to .env (keep this file private)." "Green"
}

# 4. Pick a port that nothing else is using
Step "Checking that the app's port is free"
docker compose down 2>&1 | Out-Null   # stops an earlier copy of this app, if any
$port = Get-AppPort
$owner = Get-PortOwner $port
if ($owner) {
  Say "Port $port is already used by another program on this computer:" "Yellow"
  Say "   $owner" "Yellow"
  $port = Find-FreePort
  if (-not $port) { Fail "Couldn't find a free port. Close other programs that run web servers and try again." }
  Say "The app will use port $port instead." "Green"
} else {
  Say "Port $port is free." "Green"
}
Set-EnvValue "APP_PORT" $port

# 5. Build and start
Step "Building and starting the app (the first time takes 5-10 minutes)"
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Show-Diagnostics $port; Fail "The app didn't start. Copy the messages above and send them to whoever helps you with the app." }
Say "Waiting for the app to answer..."
if (-not (Wait-ForApp $port 240)) { Show-Diagnostics $port; Fail "The app started but isn't answering on port $port. Copy the diagnostics above and send them to whoever helps you with the app." }
Say "The app is running on this computer (port $port)." "Green"

# 6. Public address
Step "Turning on the public address (Tailscale Funnel)"
& $ts funnel --bg $port
if ($LASTEXITCODE -ne 0) {
  Say ""
  Say "Tailscale needs you to allow Funnel. A page should have opened (or open the link printed above)." "Yellow"
  Say "Approve it, then press Enter."
  Read-Host | Out-Null
  & $ts funnel --bg $port
  if ($LASTEXITCODE -ne 0) { Fail "Funnel still isn't on. In the Tailscale admin console, enable HTTPS and Funnel for this computer, then run INSTALL.bat again." }
}
Say "Public address is on." "Green"

# 7. Done
Step "All set!"
Say ""
Say "  App address:  $appUrl" "Green"
Say "  Setup code:   $setupCode" "Green"
Say ""
Say "  Next:"
Say "   1. The app is opening in your browser. Choose 'First-time setup', enter the setup code,"
Say "      your name and email, and sign in with the code emailed to you."
Say "   2. Admin -> Settings -> Join code -> Create a code. Then 'Send me a test email'."
Say "   3. Announce the address and join code in quorum meeting."
Say ""
Say "  Keep this computer on and plugged in. Docker Desktop must be set to start when you sign in"
Say "  (Docker Desktop -> Settings -> General)."
Say ""
Start-Process $appUrl
Read-Host "Press Enter to close"
