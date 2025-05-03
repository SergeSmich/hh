@echo off
setlocal
cls
title Restart TorAPI Server

set PORT=8443
set NODE_PID=

echo Finding Node.js process listening on port %PORT%...

rem Ищем PID процесса, слушающего указанный порт
FOR /F "tokens=5" %%G IN ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') DO (
    set NODE_PID=%%G
    goto found_pid
)

echo No process found listening on port %PORT%. Starting server directly...
goto start_server

:found_pid
if "%NODE_PID%"=="" (
    echo WARNING: Could not automatically find PID listening on port %PORT%.
    echo Trying to kill all node.exe processes as a fallback (might affect other apps).
    taskkill /F /IM node.exe /T
    goto wait_and_start
)

echo Stopping Node.js server process (PID: %NODE_PID%)...
taskkill /F /PID %NODE_PID% /T
if errorlevel 1 (
    echo WARNING: Failed to kill process %NODE_PID% by PID. It might already be stopped or requires admin rights.
    echo Trying to kill by image name as a fallback...
    taskkill /F /IM node.exe /T
) else (
    echo Process %NODE_PID% stopped successfully.
)

:wait_and_start
echo Waiting for 2 seconds...
timeout /t 2 /nobreak > nul

:start_server
echo Starting Node.js server via 'npm start' in a new window...
rem Запускаем сервер в новом окне с заголовком
start "TorAPI Server Console" npm start

echo.
echo Server restart initiated in a new window.
echo This restart script window will close in 5 seconds.
timeout /t 5 /nobreak > nul

endlocal
exit