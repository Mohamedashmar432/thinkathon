@echo off
echo 🚀 Secure Habit Production Deployment Preparation
echo ==================================================

REM Check if we're in the right directory
if not exist "package.json" if not exist "backend" if not exist "frontend" (
    echo ❌ Error: Please run this script from the project root directory
    exit /b 1
)

echo 📋 Step 1: Cleaning up development files...

REM Remove test files and documentation (except README.md)
for /r %%i in (test_*.js) do del "%%i" 2>nul
for /r %%i in (validate_*.js) do del "%%i" 2>nul
for /r %%i in (check_*.js) do del "%%i" 2>nul
for /r %%i in (create_*.js) do del "%%i" 2>nul
for /r %%i in (*.ps1) do del "%%i" 2>nul

echo ✅ Development files cleaned up

echo 🔧 Step 2: Checking build configurations...

REM Check if backend has TypeScript config
if not exist "backend\tsconfig.json" (
    echo ❌ Error: backend\tsconfig.json not found
    exit /b 1
)

REM Check if frontend has Vite config
if not exist "frontend\vite.config.ts" (
    echo ❌ Error: frontend\vite.config.ts not found
    exit /b 1
)

echo ✅ Build configurations verified

echo 📦 Step 3: Installing dependencies...

REM Install backend dependencies
cd backend
if exist "package.json" (
    echo Installing backend dependencies...
    call npm install
    if errorlevel 1 (
        echo ❌ Error: Backend dependency installation failed
        exit /b 1
    )
) else (
    echo ❌ Error: backend\package.json not found
    exit /b 1
)

REM Install frontend dependencies
cd ..\frontend
if exist "package.json" (
    echo Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo ❌ Error: Frontend dependency installation failed
        exit /b 1
    )
) else (
    echo ❌ Error: frontend\package.json not found
    exit /b 1
)

cd ..

echo ✅ Dependencies installed successfully

echo 🏗️  Step 4: Testing builds...

REM Test backend build
cd backend
echo Testing backend build...
call npm run build
if errorlevel 1 (
    echo ❌ Error: Backend build failed
    exit /b 1
)

REM Test frontend build
cd ..\frontend
echo Testing frontend build...
call npm run build
if errorlevel 1 (
    echo ❌ Error: Frontend build failed
    exit /b 1
)

cd ..

echo ✅ Builds completed successfully

echo 🔐 Step 5: Checking environment configurations...

REM Check if environment example files exist
if not exist "backend\.env.production.example" (
    echo ❌ Warning: backend\.env.production.example not found
)

if not exist "frontend\.env.production.example" (
    echo ❌ Warning: frontend\.env.production.example not found
)

echo ✅ Environment configurations checked

echo 📝 Step 6: Generating deployment summary...

echo Secure Habit - Production Deployment Summary > DEPLOYMENT_SUMMARY.txt
echo ========================================== >> DEPLOYMENT_SUMMARY.txt
echo. >> DEPLOYMENT_SUMMARY.txt
echo Generated: %date% %time% >> DEPLOYMENT_SUMMARY.txt
echo. >> DEPLOYMENT_SUMMARY.txt
echo Backend Configuration: >> DEPLOYMENT_SUMMARY.txt
echo - Framework: Node.js + Express + TypeScript >> DEPLOYMENT_SUMMARY.txt
echo - Database: MongoDB (Atlas recommended) >> DEPLOYMENT_SUMMARY.txt
echo - Deployment Platform: Render >> DEPLOYMENT_SUMMARY.txt
echo - Build Command: npm install ^&^& npm run build >> DEPLOYMENT_SUMMARY.txt
echo - Start Command: npm start >> DEPLOYMENT_SUMMARY.txt
echo - Health Check: /health >> DEPLOYMENT_SUMMARY.txt
echo. >> DEPLOYMENT_SUMMARY.txt
echo Frontend Configuration: >> DEPLOYMENT_SUMMARY.txt
echo - Framework: React + Vite + TypeScript >> DEPLOYMENT_SUMMARY.txt
echo - Deployment Platform: Vercel >> DEPLOYMENT_SUMMARY.txt
echo - Build Command: npm run build >> DEPLOYMENT_SUMMARY.txt
echo - Output Directory: dist >> DEPLOYMENT_SUMMARY.txt
echo. >> DEPLOYMENT_SUMMARY.txt
echo Required Environment Variables: >> DEPLOYMENT_SUMMARY.txt
echo Backend: >> DEPLOYMENT_SUMMARY.txt
echo - NODE_ENV=production >> DEPLOYMENT_SUMMARY.txt
echo - MONGODB_URI=^<your-mongodb-connection-string^> >> DEPLOYMENT_SUMMARY.txt
echo - JWT_SECRET=^<32-character-secret^> >> DEPLOYMENT_SUMMARY.txt
echo - FRONTEND_URL=^<your-vercel-url^> >> DEPLOYMENT_SUMMARY.txt
echo - GEMINI_API_KEY_1=^<your-gemini-key^> >> DEPLOYMENT_SUMMARY.txt
echo. >> DEPLOYMENT_SUMMARY.txt
echo Frontend: >> DEPLOYMENT_SUMMARY.txt
echo - VITE_API_URL=^<your-render-backend-url^> >> DEPLOYMENT_SUMMARY.txt
echo. >> DEPLOYMENT_SUMMARY.txt
echo Next Steps: >> DEPLOYMENT_SUMMARY.txt
echo 1. Set up MongoDB Atlas database >> DEPLOYMENT_SUMMARY.txt
echo 2. Deploy backend to Render >> DEPLOYMENT_SUMMARY.txt
echo 3. Deploy frontend to Vercel >> DEPLOYMENT_SUMMARY.txt
echo 4. Configure environment variables >> DEPLOYMENT_SUMMARY.txt
echo 5. Update CORS settings >> DEPLOYMENT_SUMMARY.txt
echo 6. Run integration tests >> DEPLOYMENT_SUMMARY.txt
echo. >> DEPLOYMENT_SUMMARY.txt
echo For detailed instructions, see PRODUCTION_DEPLOYMENT_GUIDE.md >> DEPLOYMENT_SUMMARY.txt

echo ✅ Deployment summary generated

echo.
echo 🎉 Production deployment preparation complete!
echo.
echo 📋 Next Steps:
echo 1. Review PRODUCTION_DEPLOYMENT_GUIDE.md for detailed instructions
echo 2. Use DEPLOYMENT_CHECKLIST.md to track your progress
echo 3. Set up MongoDB Atlas database
echo 4. Deploy to Render (backend) and Vercel (frontend)
echo 5. Configure environment variables on both platforms
echo.
echo 📁 Important Files Created:
echo - PRODUCTION_DEPLOYMENT_GUIDE.md (Complete deployment guide)
echo - DEPLOYMENT_CHECKLIST.md (Step-by-step checklist)
echo - backend\.env.production.example (Backend environment template)
echo - frontend\.env.production.example (Frontend environment template)
echo - DEPLOYMENT_SUMMARY.txt (Quick reference)
echo.
echo 🔗 Recommended Deployment Platforms:
echo - Backend: https://render.com
echo - Frontend: https://vercel.com
echo - Database: https://www.mongodb.com/atlas
echo.
echo Good luck with your deployment! 🚀

pause