@echo off
title PM2 Server Manager

set "PARSER_SCRIPT=parser.py"

:Menu
cls
echo ==========================
echo  PM2 Server Management
echo ==========================
echo 1. Start/Restart All Servers (via PM2)
echo 2. Stop All Servers (via PM2)
echo 3. Show Status & Logs (via PM2)
echo 4. Update Data (Run %PARSER_SCRIPT%)
echo 5. Exit
echo ==========================
set /p choice="Select an option (1-5): "

if "%choice%"=="1" goto StartRestart
if "%choice%"=="2" goto StopDelete
if "%choice%"=="3" goto StatusLogs
if "%choice%"=="4" goto RunParser
if "%choice%"=="5" goto :eof

echo Invalid choice. Press any key to continue...
pause > nul
goto Menu

:StartRestart
echo [*] Starting or restarting all applications via PM2...
pm2 restart ecosystem.config.js --update-env || pm2 start ecosystem.config.js
echo [*] Servers should be running in the background. Use option 3 to check.
echo.
pause
goto Menu

:StopDelete
echo [*] Stopping and deleting all applications from PM2...
pm2 stop all
pm2 delete all
echo [*] PM2 process list should be empty.
echo.
pause
goto Menu

:StatusLogs
echo [*] Displaying PM2 status (list) and logs...
pm2 list
echo.
echo [*] Tailing logs (Press Ctrl+C to stop viewing logs)...
pm2 logs --lines 20
echo.
echo Press any key to return to menu...
pause > nul
goto Menu

:RunParser
echo [*] Starting %PARSER_SCRIPT% to update data...
if not exist "%PARSER_SCRIPT%" (
    echo    ERROR: %PARSER_SCRIPT% not found!
    pause
    goto Menu
)
echo    Running parser in this window... Please wait...
python %PARSER_SCRIPT%
echo    Parser finished. PM2 should restart 'Backend' if data.json was updated (check logs).
echo.
pause
goto Menu

:eof
exit