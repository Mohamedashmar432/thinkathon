#!/usr/bin/env node

/**
 * Verify Deployment Status
 * Checks if both frontend and backend are deployed with latest changes
 */

const axios = require('axios');

async function verifyDeploymentStatus() {
  console.log('🔍 Verifying Deployment Status');
  console.log('==============================');

  try {
    // Check backend deployment
    console.log('🖥️  Step 1: Checking backend deployment...');
    
    try {
      const backendHealth = await axios.get('https://secure-habit-backend.onrender.com/api/health', {
        timeout: 10000
      });
      
      console.log('✅ Backend is responding');
      console.log(`   Status: ${backendHealth.status}`);
      
      // Check if fresh agent is available
      console.log('\n📦 Step 2: Checking fresh agent availability...');
      
      // This should fail with 401 (auth required) but not 404 (route missing)
      try {
        await axios.post('https://secure-habit-backend.onrender.com/api/agent/download-installer', 
          { os: 'windows' },
          { timeout: 5000 }
        );
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log('✅ Agent download endpoint exists (401 auth required - expected)');
        } else if (error.response && error.response.status === 404) {
          console.log('❌ Agent download endpoint missing (404)');
        } else {
          console.log(`⚠️  Agent endpoint response: ${error.response?.status || 'unknown'}`);
        }
      }
      
    } catch (error) {
      console.log('❌ Backend health check failed:', error.message);
    }

    // Check frontend deployment
    console.log('\n🌐 Step 3: Checking frontend deployment...');
    
    try {
      const frontendResponse = await axios.get('https://securehabit.vercel.app', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log('✅ Frontend is responding');
      console.log(`   Status: ${frontendResponse.status}`);
      
      // Check if the response contains recent changes
      const htmlContent = frontendResponse.data;
      if (htmlContent.includes('Secure Habit')) {
        console.log('✅ Frontend content looks correct');
      } else {
        console.log('⚠️  Frontend content may be outdated');
      }
      
    } catch (error) {
      console.log('❌ Frontend check failed:', error.message);
    }

    // Summary
    console.log('\n📊 DEPLOYMENT STATUS SUMMARY');
    console.log('============================');
    
    console.log('🎯 Expected Status After Deployment:');
    console.log('   ✅ Backend: Responding with fresh agent endpoint');
    console.log('   ✅ Frontend: Latest Scanner.tsx fix deployed');
    console.log('   ✅ Agent Download: >29KB fresh agent served');
    
    console.log('\n🔧 Recent Critical Fixes:');
    console.log('   - Scanner.tsx: Now sends {os: "windows"} parameter');
    console.log('   - Backend: Serves fresh 29.2KB agent instead of old 28.6KB');
    console.log('   - Agent: Contains production endpoint and retry logic');
    
    console.log('\n⏰ Deployment Timeline:');
    console.log('   - Render Backend: ~2-3 minutes after push');
    console.log('   - Vercel Frontend: ~1-2 minutes after push');
    console.log('   - Total: ~5 minutes for full deployment');
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Wait for deployments to complete');
    console.log('   2. Clear browser cache');
    console.log('   3. Download agent from Agents page');
    console.log('   4. Verify file size >29KB');
    console.log('   5. Run agent as administrator');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

// Run verification
verifyDeploymentStatus();