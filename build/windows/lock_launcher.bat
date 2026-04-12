@echo off
REM ============================================================
REM  Digital Logbook - Lock Mode Launcher
REM  This script ensures the app auto-restarts if it crashes.
REM  Place this in the same folder as Digital Logbook.exe
REM  
REM  Usage: Replace the startup registry/shortcut to point to 
REM         this .bat file instead of the .exe directly.
REM ============================================================

title Digital Logbook Lock Mode
echo Starting Digital Logbook in Lock Mode...

:loop
    REM Start the application and wait for it to exit
    start /wait "" "%~dp0Digital Logbook.exe"
    
    REM If the app exited, wait 3 seconds then restart
    echo Application closed. Restarting in 3 seconds...
    timeout /t 3 /nobreak >nul
goto loop
