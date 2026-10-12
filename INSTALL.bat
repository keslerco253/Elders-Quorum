@echo off
REM Double-click to run. See START-HERE.txt.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\install.ps1"
if errorlevel 1 pause
