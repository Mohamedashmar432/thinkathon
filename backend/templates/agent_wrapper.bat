@echo off
REM Secure Habit Agent Launcher
REM This batch file will execute the PowerShell agent with proper permissions

title Secure Habit - Security Agent

echo.
echo ========================================
echo    Secure Habit - Security Agent
echo ========================================
echo.
echo Starting security scan...
echo This may take a few minutes.
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrator privileges confirmed.
    goto :run_agent
) else (
    echo Requesting administrator privileges...
    echo.
    REM Re-run this batch file as administrator
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:run_agent
echo.
echo Executing security agent...
echo.

REM Set execution policy temporarily and run the PowerShell script
powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0secure_habit_agent.ps1" -Silent

if %errorLevel% == 0 (
    echo.
    echo ========================================
    echo   Security scan completed successfully!
    echo ========================================
    echo.
    echo Your device security data has been sent
    echo to the Secure Habit platform.
    echo.
    echo Check your dashboard for results.
    echo.
) else (
    echo.
    echo ========================================
    echo      Security scan encountered an error
    echo ========================================
    echo.
    echo Please check your internet connection
    echo and try again.
    echo.
)

echo Press any key to close...
pause >nul