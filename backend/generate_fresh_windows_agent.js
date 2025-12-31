#!/usr/bin/env node

/**
 * GENERATE FRESH WINDOWS AGENT
 * 
 * This script generates a fresh Windows agent with the correct production endpoint
 * for immediate testing.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 GENERATING FRESH WINDOWS AGENT');
console.log('=================================\n');

// Read the Windows agent template
const templatePath = path.join(__dirname, 'templates', 'secure_habit_agent.ps1');
let agentTemplate = fs.readFileSync(templatePath, 'utf-8');

// Production configuration
const PRODUCTION_ENDPOINT = 'https://secure-habit-backend.onrender.com/api/scan/submit';
const USER_EMAIL = 'mohamedashmar123@gmail.com';
const API_KEY = '42627a39b74bf1cb44d801d9dc861a85f4524495cb1dc63a93712aace6a7c5f7'; // Your existing API key

console.log('📋 Agent Configuration');
console.log('======================');
console.log(`User Email: ${USER_EMAIL}`);
console.log(`API Endpoint: ${PRODUCTION_ENDPOINT}`);
console.log(`API Key: ${API_KEY.substring(0, 8)}...`);

// Replace placeholders with production values
agentTemplate = agentTemplate
  .replace(/{{USER_EMAIL}}/g, USER_EMAIL)
  .replace(/{{API_ENDPOINT}}/g, PRODUCTION_ENDPOINT)
  .replace(/{{API_KEY}}/g, API_KEY);

// Verify the replacements
console.log('\n🔍 Verification');
console.log('===============');

if (agentTemplate.includes(PRODUCTION_ENDPOINT)) {
    console.log('✅ Production endpoint correctly embedded');
} else {
    console.log('❌ Production endpoint not found');
}

if (agentTemplate.includes(USER_EMAIL)) {
    console.log('✅ User email correctly embedded');
} else {
    console.log('❌ User email not found');
}

if (agentTemplate.includes(API_KEY)) {
    console.log('✅ API key correctly embedded');
} else {
    console.log('❌ API key not found');
}

if (!agentTemplate.includes('localhost') && !agentTemplate.includes('127.0.0.1')) {
    console.log('✅ No localhost references found');
} else {
    console.log('❌ Localhost references still present');
}

// Create the batch installer wrapper
const batchTemplate = `@echo off
REM Secure Habit Agent - Self-Extracting Installer
REM This file contains the PowerShell agent embedded within it

title Secure Habit - Security Agent Installer

echo.
echo ==========================================
echo    Secure Habit - Security Agent
echo ==========================================
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
echo ==========================================
echo        Starting Security Scan
echo ==========================================
echo.

REM Create temporary directory for agent
set TEMP_DIR=%TEMP%\\SecureHabitAgent_%RANDOM%
mkdir "%TEMP_DIR%" 2>nul

REM Extract PowerShell script from this batch file (after the marker)
echo Extracting agent components...
for /f "tokens=1* delims=:" %%a in ('findstr /n "REM_POWERSHELL_START" "%~f0"') do set START_LINE=%%a
set /a START_LINE+=1
more +%START_LINE% "%~f0" > "%TEMP_DIR%\\agent.ps1"

REM Execute the PowerShell agent
echo Running security scan...
echo.
powershell -ExecutionPolicy Bypass -WindowStyle Normal -File "%TEMP_DIR%\\agent.ps1" -Silent

REM Check execution result
if %errorLevel% == 0 (
    echo.
    echo ==========================================
    echo   ✓ Security Scan Completed Successfully
    echo ==========================================
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
    echo ==========================================
    echo      ⚠ Security Scan Error
    echo ==========================================
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
del /q "%TEMP_DIR%\\agent.ps1" 2>nul
rmdir "%TEMP_DIR%" 2>nul

echo Press any key to close this window...
pause >nul
exit /b

REM_POWERSHELL_START
${agentTemplate}`;

// Write the fresh agent
const outputPath = path.join(__dirname, '..', 'FRESH_SecureHabitAgent_PRODUCTION.bat');
fs.writeFileSync(outputPath, batchTemplate);

console.log('\n✅ Fresh Windows Agent Generated');
console.log('===============================');
console.log(`📁 File: ${outputPath}`);
console.log('🔧 Configuration: Production-ready');
console.log('🌐 Endpoint: Production backend');
console.log('🔑 Authentication: Your API key');

console.log('\n📋 Instructions');
console.log('===============');
console.log('1. Right-click the generated .bat file');
console.log('2. Select "Run as administrator"');
console.log('3. Click "Yes" when Windows UAC prompts');
console.log('4. Wait for the scan to complete (2-5 minutes)');
console.log('5. Check your dashboard for results');

console.log('\n🎯 Expected Results');
console.log('==================');
console.log('✅ Agent will connect to production backend');
console.log('✅ Scan will complete successfully');
console.log('✅ Results will appear in your dashboard');
console.log('✅ Agent will show as "Active" in agent panel');

console.log('\n🚀 FRESH AGENT READY FOR TESTING!');