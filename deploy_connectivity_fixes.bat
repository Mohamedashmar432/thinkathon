@echo off
echo ========================================
echo  Deploy Agent Connectivity Fixes
echo ========================================
echo.

echo 🔍 Running connectivity validation...
node test_agent_connectivity_comprehensive.js
if %errorlevel% neq 0 (
    echo ❌ Connectivity test failed! Checking if backend needs deployment...
    echo.
    echo This is expected if backend changes haven't been deployed yet.
    echo Proceeding with deployment...
)

echo.
echo 📝 Committing connectivity fixes...
git add .
git commit -m "Fix agent connectivity - add missing registration and heartbeat endpoints

- Add POST /api/agent/register endpoint for agent registration
- Add POST /api/agent/:deviceId/heartbeat endpoint for agent status updates  
- Enhance PowerShell agent with better error handling and retry logic
- Improve scan submission with detailed logging and validation
- Add comprehensive connectivity testing
- Fix authentication middleware for API key validation
- Update agent templates with enhanced connectivity features"

if %errorlevel% neq 0 (
    echo ❌ Git commit failed!
    pause
    exit /b 1
)

echo.
echo 🚀 Pushing connectivity fixes to production...
git push origin main

if %errorlevel% neq 0 (
    echo ❌ Git push failed!
    pause
    exit /b 1
)

echo.
echo ✅ Deployment initiated successfully!
echo.
echo 📋 Next Steps:
echo 1. Wait 2-3 minutes for Render to deploy
echo 2. Run: node test_agent_connectivity_comprehensive.js
echo 3. Test agent download and execution manually
echo 4. Monitor agent registrations in dashboard
echo.
echo Press any key to continue...
pause >nul