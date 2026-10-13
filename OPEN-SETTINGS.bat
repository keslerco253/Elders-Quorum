@echo off
REM Double-click to open the app's settings (email password, texting keys) in Notepad.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\open-settings.ps1"
if errorlevel 1 pause
