@echo off
echo ========================================
echo  Deploy Agent Download Fixes to Production
echo ========================================
echo.

echo 🔍 Running final validation...
node validate_system_ready_for_production.js
if %errorlevel% neq 0 (
    echo ❌ Validation failed! Please fix issues before deployment.
    pause
    exit /b 1
)

echo.
echo ✅ Validation passed! Ready for deployment.
echo.

echo 📝 Committing changes...
git add .
git commit -m "Fix agent download system - resolve hardcoded credentials and update to v2.0.0

- Remove hardcoded demo credentials from production templates
- Update all templates to version 2.0.0  
- Fix branding from Thinkathon to Secure Habit
- Clean up legacy template files
- Improve credential replacement logic
- Add production URL configuration
- Enhance agent features with retry logic and better error handling"

if %errorlevel% neq 0 (
    echo ❌ Git commit failed!
    pause
    exit /b 1
)

echo.
echo 🚀 Pushing to production...
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
echo 2. Run: node validate_production_agent_system.js
echo 3. Test agent download manually at: https://secure-habit.onrender.com
echo 4. Use demo account: mohamedashmar123@gmail.com / sudo12345
echo.
echo Press any key to continue...
pause >nul