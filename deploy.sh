#!/bin/bash

# Secure Habit Production Deployment Script
# This script helps prepare the application for production deployment

echo "🚀 Secure Habit Production Deployment Preparation"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d "backend" ] && [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📋 Step 1: Cleaning up development files..."

# Remove test files and documentation (except README.md)
find . -name "test_*.js" -type f -delete
find . -name "validate_*.js" -type f -delete
find . -name "check_*.js" -type f -delete
find . -name "create_*.js" -type f -delete
find . -name "*.md" -not -name "README.md" -not -name "PRODUCTION_DEPLOYMENT_GUIDE.md" -not -name "DEPLOYMENT_CHECKLIST.md" -type f -delete
find . -name "*.ps1" -type f -delete

echo "✅ Development files cleaned up"

echo "🔧 Step 2: Checking build configurations..."

# Check if backend has TypeScript config
if [ ! -f "backend/tsconfig.json" ]; then
    echo "❌ Error: backend/tsconfig.json not found"
    exit 1
fi

# Check if frontend has Vite config
if [ ! -f "frontend/vite.config.ts" ]; then
    echo "❌ Error: frontend/vite.config.ts not found"
    exit 1
fi

echo "✅ Build configurations verified"

echo "📦 Step 3: Installing dependencies..."

# Install backend dependencies
cd backend
if [ -f "package.json" ]; then
    echo "Installing backend dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error: Backend dependency installation failed"
        exit 1
    fi
else
    echo "❌ Error: backend/package.json not found"
    exit 1
fi

# Install frontend dependencies
cd ../frontend
if [ -f "package.json" ]; then
    echo "Installing frontend dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error: Frontend dependency installation failed"
        exit 1
    fi
else
    echo "❌ Error: frontend/package.json not found"
    exit 1
fi

cd ..

echo "✅ Dependencies installed successfully"

echo "🏗️  Step 4: Testing builds..."

# Test backend build
cd backend
echo "Testing backend build..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error: Backend build failed"
    exit 1
fi

# Test frontend build
cd ../frontend
echo "Testing frontend build..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error: Frontend build failed"
    exit 1
fi

cd ..

echo "✅ Builds completed successfully"

echo "🔐 Step 5: Checking environment configurations..."

# Check if environment example files exist
if [ ! -f "backend/.env.production.example" ]; then
    echo "❌ Warning: backend/.env.production.example not found"
fi

if [ ! -f "frontend/.env.production.example" ]; then
    echo "❌ Warning: frontend/.env.production.example not found"
fi

echo "✅ Environment configurations checked"

echo "📝 Step 6: Generating deployment summary..."

cat << EOF > DEPLOYMENT_SUMMARY.txt
Secure Habit - Production Deployment Summary
==========================================

Generated: $(date)

Backend Configuration:
- Framework: Node.js + Express + TypeScript
- Database: MongoDB (Atlas recommended)
- Deployment Platform: Render
- Build Command: npm install && npm run build
- Start Command: npm start
- Health Check: /health

Frontend Configuration:
- Framework: React + Vite + TypeScript
- Deployment Platform: Vercel
- Build Command: npm run build
- Output Directory: dist

Required Environment Variables:
Backend:
- NODE_ENV=production
- MONGODB_URI=<your-mongodb-connection-string>
- JWT_SECRET=<32-character-secret>
- FRONTEND_URL=<your-vercel-url>
- GEMINI_API_KEY_1=<your-gemini-key>

Frontend:
- VITE_API_URL=<your-render-backend-url>

Next Steps:
1. Set up MongoDB Atlas database
2. Deploy backend to Render
3. Deploy frontend to Vercel
4. Configure environment variables
5. Update CORS settings
6. Run integration tests

For detailed instructions, see PRODUCTION_DEPLOYMENT_GUIDE.md
EOF

echo "✅ Deployment summary generated"

echo ""
echo "🎉 Production deployment preparation complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Review PRODUCTION_DEPLOYMENT_GUIDE.md for detailed instructions"
echo "2. Use DEPLOYMENT_CHECKLIST.md to track your progress"
echo "3. Set up MongoDB Atlas database"
echo "4. Deploy to Render (backend) and Vercel (frontend)"
echo "5. Configure environment variables on both platforms"
echo ""
echo "📁 Important Files Created:"
echo "- PRODUCTION_DEPLOYMENT_GUIDE.md (Complete deployment guide)"
echo "- DEPLOYMENT_CHECKLIST.md (Step-by-step checklist)"
echo "- backend/.env.production.example (Backend environment template)"
echo "- frontend/.env.production.example (Frontend environment template)"
echo "- DEPLOYMENT_SUMMARY.txt (Quick reference)"
echo ""
echo "🔗 Recommended Deployment Platforms:"
echo "- Backend: https://render.com"
echo "- Frontend: https://vercel.com"
echo "- Database: https://www.mongodb.com/atlas"
echo ""
echo "Good luck with your deployment! 🚀"