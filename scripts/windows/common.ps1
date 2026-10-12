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

function Wait-ForApp($seconds = 180) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 5
      if ($r.StatusCode -eq 200) { return $true }
    } catch { }
    Start-Sleep -Seconds 3
  }
  return $false
}
