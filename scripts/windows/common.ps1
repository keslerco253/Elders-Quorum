# Shared helpers for the Windows scripts. Works in Windows PowerShell 5.1.
# Errors are checked by hand ($LASTEXITCODE); "Stop" would turn harmless
# messages from docker/tailscale into crashes in Windows PowerShell 5.1.
$ErrorActionPreference = "Continue"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $Root

# Settings and backups live outside the app folder, so a new version can be
# unzipped anywhere and UPDATE.bat still finds them. The database itself is in
# Docker (volume "elders-quorum-data"), which doesn't depend on the folder either.
$DataHome = Join-Path $env:USERPROFILE "EldersQuorumApp"
$SettingsFile = Join-Path $DataHome "settings.env"
$BackupDir = Join-Path $DataHome "backups"
$ProjectName = "elders-quorum"

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

# Runs "docker compose" for this app with the settings file and backup folder.
function Compose {
  $env:EQ_ENV_FILE = $SettingsFile
  $env:EQ_BACKUP_DIR = $BackupDir
  docker compose -p $ProjectName --env-file $SettingsFile @args
}

# Containers (from any app folder, old or new) that use the app's database.
function Get-AppContainers {
  $ids = @(docker ps -a -q --filter "volume=elders-quorum-data" 2>$null)
  foreach ($id in $ids) {
    if (-not $id) { continue }
    try { (docker inspect $id | Out-String | ConvertFrom-Json)[0] } catch { }
  }
}

# Makes sure the settings file exists. Older versions kept it as ".env" (and the
# backups folder) inside the app folder; those are copied over the first time.
# Returns $false if no settings were found anywhere.
function Initialize-Settings {
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  if (Test-Path $SettingsFile) { return $true }
  $folders = @($Root)
  foreach ($c in Get-AppContainers) {
    $wd = $c.Config.Labels."com.docker.compose.project.working_dir"
    if ($wd) { $folders += $wd }
  }
  $old = $folders | Select-Object -Unique | Where-Object { Test-Path (Join-Path $_ ".env") } | Select-Object -First 1
  if (-not $old) {
    # The app isn't running: look for the newest older app folder in the usual places.
    $places = @("Documents", "Desktop", "Downloads", "OneDrive") | ForEach-Object { Join-Path $env:USERPROFILE $_ } | Where-Object { Test-Path $_ }
    $old = Get-ChildItem -Path $places -Filter "docker-compose.yml" -Recurse -Depth 3 -ErrorAction SilentlyContinue |
      ForEach-Object { Get-Item -Force -ErrorAction SilentlyContinue (Join-Path $_.DirectoryName ".env") } |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1 | ForEach-Object { $_.DirectoryName }
  }
  if (-not $old) { return $false }
  Copy-Item (Join-Path $old ".env") $SettingsFile
  $oldBackups = Join-Path $old "backups"
  if (Test-Path $oldBackups) { Copy-Item (Join-Path $oldBackups "*") $BackupDir -Recurse -Force -ErrorAction SilentlyContinue }
  Say "Moved your settings and backups from $old" "Green"
  Say "  to $DataHome" "Green"
  return $true
}

# If the settings don't say which port the app uses, keeps the one the running
# copy uses now (so Tailscale keeps pointing at the right place).
function Save-CurrentPort {
  if ((Read-EnvFile)["APP_PORT"]) { return }
  foreach ($c in Get-AppContainers) {
    $binding = $c.HostConfig.PortBindings."3000/tcp"
    if ($binding -and $binding[0].HostPort) {
      Set-EnvValue "APP_PORT" $binding[0].HostPort
      Say "Kept the app on port $($binding[0].HostPort)."
      return
    }
  }
}

# Stops a copy of the app started from a different folder (older versions named
# it after the folder), so the new one can use the same port and database.
function Remove-OtherCopies {
  foreach ($c in Get-AppContainers) {
    $project = $c.Config.Labels."com.docker.compose.project"
    if ($project -and $project -ne $ProjectName) {
      docker rm -f $c.Id | Out-Null
      Say "Stopped an older copy of the app (from $($c.Config.Labels."com.docker.compose.project.working_dir"))."
    }
  }
}

function Test-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  docker info *> $null
  return ($LASTEXITCODE -eq 0)
}

# Reads KEY=value pairs from the settings file into a hashtable.
function Read-EnvFile {
  $values = @{}
  if (Test-Path $SettingsFile) {
    foreach ($line in Get-Content $SettingsFile) {
      if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $values[$Matches[1]] = $Matches[2].Trim() }
    }
  }
  return $values
}

# Writes UTF-8 without a byte-order mark (Docker can't read the BOM).
function Write-Utf8NoBom($path, $text) {
  [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

# The port the app listens on (APP_PORT in the settings file, default 3000).
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

# Sets one KEY=value line in the settings file, keeping everything else as it is.
function Set-EnvValue($key, $value) {
  $path = $SettingsFile
  $lines = @()
  if (Test-Path $path) { $lines = @(Get-Content $path) }
  $found = $false
  $lines = foreach ($line in $lines) {
    if ($line -match "^\s*$key\s*=") { $found = $true; "$key=$value" } else { $line }
  }
  if (-not $found) { $lines = @($lines) + "$key=$value" }
  Write-Utf8NoBom $path ((@($lines) -join "`n") + "`n")
}

# Asks the app itself on 127.0.0.1 (not "localhost", which Windows may send to
# a different program listening on the IPv6 address ::1).
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
  Compose ps
  Say ""
  Compose logs --tail 40 app
  Say "--------------------------------------------------------------------" "Yellow"
}
