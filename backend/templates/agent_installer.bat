@echo off
REM Secure Habit Agent - Self-Extracting Installer
REM This file contains the PowerShell agent embedded within it

title Secure Habit - Security Agent Installer

echo.
echo ========================================
echo    Secure Habit - Security Agent
echo ========================================
echo.
echo Welcome to Secure Habit Security Agent
echo.
echo This agent will:
echo  - Scan your system for security vulnerabilities
echo  - Identify outdated software and patches  
echo  - Send encrypted results to your dashboard
echo  - Complete in 2-5 minutes
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✓ Administrator privileges confirmed
    goto :extract_and_run
) else (
    echo ⚠ Administrator privileges required
    echo.
    echo Requesting administrator access...
    echo Please click "Yes" when prompted.
    echo.
    REM Re-run this batch file as administrator
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:extract_and_run
echo.
echo ========================================
echo        Starting Security Scan
echo ========================================
echo.

REM Create temporary directory for agent
set TEMP_DIR=%TEMP%\SecureHabitAgent_%RANDOM%
mkdir "%TEMP_DIR%" 2>nul

REM Extract PowerShell script from this batch file (after the marker)
echo Extracting agent components...
for /f "tokens=1* delims=:" %%a in ('findstr /n "REM_POWERSHELL_START" "%~f0"') do set START_LINE=%%a
set /a START_LINE+=1
more +%START_LINE% "%~f0" > "%TEMP_DIR%\agent.ps1"

REM Execute the PowerShell agent
echo Running security scan...
echo.
powershell -ExecutionPolicy Bypass -WindowStyle Normal -File "%TEMP_DIR%\agent.ps1" -Silent

REM Check execution result
if %errorLevel% == 0 (
    echo.
    echo ========================================
    echo   ✓ Security Scan Completed Successfully
    echo ========================================
    echo.
    echo Your device has been scanned and the results
    echo have been securely sent to your Secure Habit
    echo dashboard.
    echo.
    echo 🌐 Visit your dashboard to view:
    echo   - Security score and recommendations
    echo   - Detected vulnerabilities  
    echo   - Software inventory
    echo   - Improvement suggestions
    echo.
) else (
    echo.
    echo ========================================
    echo      ⚠ Security Scan Error
    echo ========================================
    echo.
    echo The security scan encountered an issue.
    echo This could be due to:
    echo   - Network connectivity problems
    echo   - Firewall blocking the connection
    echo   - Antivirus interference
    echo.
    echo Please try again or contact support.
    echo.
)

REM Cleanup
del /q "%TEMP_DIR%\agent.ps1" 2>nul
rmdir "%TEMP_DIR%" 2>nul

echo Press any key to close this window...
pause >nul
exit /b

REM_POWERSHELL_START
{{POWERSHELL_AGENT_CONTENT}}