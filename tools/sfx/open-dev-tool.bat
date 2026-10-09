@echo off
rem Opens the Finsanity dev tool (sound audition + Formulas + Variables + Commit to GitHub) in your browser.
rem Starts the tool's server (port 8081) and the game's server (port 8080) first if they are not already running.
rem The desktop shortcut "Finsanity Dev Tool" points here; re-create it with tools\sfx\make-desktop-shortcut.ps1.
cd /d "%~dp0..\.."

netstat -ano | findstr /R /C:":8081 .*LISTENING" >nul
if errorlevel 1 (
  start "Finsanity dev tool (8081)" /min cmd /c "node tools\sfx\server.mjs"
)
netstat -ano | findstr /R /C:":8080 .*LISTENING" >nul
if errorlevel 1 (
  start "Finsanity game (8080)" /min cmd /c "node server.js"
)

rem Give the servers a moment to come up before the browser asks for the page.
timeout /t 2 /nobreak >nul
start "" "http://localhost:8081"
