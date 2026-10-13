# Opens the app's settings file in Notepad. Run with OPEN-SETTINGS.bat.
. (Join-Path $PSScriptRoot "common.ps1")

if (-not (Initialize-Settings)) { Fail "Couldn't find this app's settings. Run INSTALL.bat first." }
Say "Opening $SettingsFile"
Say "Keep this file private: it holds the email password and any texting keys." "Yellow"
Say "After you save changes, run UPDATE.bat so the app uses them."
Start-Process notepad.exe -ArgumentList "`"$SettingsFile`""
Read-Host "Press Enter to close"
