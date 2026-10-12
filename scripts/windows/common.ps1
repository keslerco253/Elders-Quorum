# Shared helpers for the Windows scripts. Works in Windows PowerShell 5.1.
# Errors are checked by hand ($LASTEXITCODE); "Stop" would turn harmless
# messages from docker/tailscale into crashes in Windows PowerShell 5.1.
$ErrorActionPreference = "Continue"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $Root

function Say($text, $color = "White") { Write-Host $text -ForegroundColor $color }
function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Fail($text) {
  Write-Host ""
  Write-Host $text -ForegroundColor Red
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

function Find-Tailscale {
  $cmd = Get-Command tailscale -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $default = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"
  if (Test-Path $default) { return $default }
  return $null
}

function Test-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  docker info *> $null
  return ($LASTEXITCODE -eq 0)
}

# Reads KEY=value pairs from .env into a hashtable.
function Read-EnvFile {
  $values = @{}
  if (Test-Path (Join-Path $Root ".env")) {
    foreach ($line in Get-Content (Join-Path $Root ".env")) {
      if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $values[$Matches[1]] = $Matches[2].Trim() }
    }
  }
  return $values
}

# Writes UTF-8 without a byte-order mark (Docker can't read the BOM).
function Write-Utf8NoBom($path, $text) {
  [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

# The port the app listens on (APP_PORT in .env, default 3000).
function Get-AppPort {
  $v = (Read-EnvFile)["APP_PORT"]
  if ($v -match '^\d+$') { return [int]$v }
  return 3000
}

# Which program (if any) is listening on a port. Returns $null when free.
function Get-PortOwner([int]$port) {
  try {
    $conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop
  } catch {
    return $null
  }
  $owners = foreach ($c in $conns) {
    $name = "unknown"
    try { $name = (Get-Process -Id $c.OwningProcess -ErrorAction Stop).ProcessName } catch { }
    "$name (process $($c.OwningProcess)) on $($c.LocalAddress)"
  }
  return (($owners | Sort-Object -Unique) -join "; ")
}

# First port in the list that nothing is listening on.
function Find-FreePort {
  foreach ($p in 3000, 3300, 8300, 8380, 18300, 28300) {
    if (-not (Get-PortOwner $p)) { return $p }
  }
  return $null
}

# Asks the app itself on 127.0.0.1 (not "localhost", which Windows may send to
# a different program listening on the IPv6 address ::1).
# Sets one KEY=value line in .env, keeping everything else as it is.
function Set-EnvValue($key, $value) {
  $path = Join-Path $Root ".env"
  $lines = @()
  if (Test-Path $path) { $lines = @(Get-Content $path) }
  $found = $false
  $lines = foreach ($line in $lines) {
    if ($line -match "^\s*$key\s*=") { $found = $true; "$key=$value" } else { $line }
  }
  if (-not $found) { $lines = @($lines) + "$key=$value" }
  Write-Utf8NoBom $path ((@($lines) -join "`n") + "`n")
}

function Wait-ForApp([int]$port, [int]$seconds = 180) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200 -and $r.Content -match "elders-quorum") { return $true }
    } catch { }
    Start-Sleep -Seconds 3
  }
  return $false
}

# Prints what's needed to figure out why the app isn't answering.
function Show-Diagnostics([int]$port) {
  Say ""
  Say "---- Diagnostics (send this to whoever helps you with the app) ----" "Yellow"
  $owner = Get-PortOwner $port
  if ($owner) { Say "Listening on port ${port}: $owner" } else { Say "Nothing is listening on port $port." }
  Say ""
  docker compose ps
  Say ""
  docker compose logs --tail 40 app
  Say "--------------------------------------------------------------------" "Yellow"
}
