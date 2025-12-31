#!/usr/bin/env node

/**
 * Generate User-Specific Fresh Windows Agent
 * Creates a production-ready agent with correct user credentials
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Generating User-Specific Fresh Windows Agent');
console.log('===============================================');

// Get user credentials from command line or use defaults
const userEmail = process.argv[2] || 'mohamedashmar123@gmail.com';
const apiKey = process.argv[3] || '42627a39b74bf1cb44d801d9dc861a85f4524495cb1dc63a93712aace6a7c5f7';

console.log(`📧 User Email: ${userEmail}`);
console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...`);

// Read the fresh production agent template
const freshAgentPath = 'FRESH_SecureHabitAgent_PRODUCTION.bat';

if (!fs.existsSync(freshAgentPath)) {
  console.error('❌ Fresh production agent template not found!');
  console.error('   Expected file: FRESH_SecureHabitAgent_PRODUCTION.bat');
  process.exit(1);
}

console.log('📖 Reading fresh production agent template...');
let agentContent = fs.readFileSync(freshAgentPath, 'utf-8');

// Replace credentials with user-specific ones
console.log('🔄 Updating credentials...');
agentContent = agentContent
  .replace(/mohamedashmar123@gmail\.com/g, userEmail)
  .replace(/42627a39b74bf1cb44d801d9dc861a85f4524495cb1dc63a93712aace6a7c5f7/g, apiKey);

// Verify the production endpoint is correct
if (!agentContent.includes('https://secure-habit-backend.onrender.com/api/scan/submit')) {
  console.error('❌ Production endpoint not found in agent!');
  console.error('   Expected: https://secure-habit-backend.onrender.com/api/scan/submit');
  process.exit(1);
}

console.log('✅ Production endpoint verified');

// Write user-specific agent
const outputPath = `SecureHabitAgent_${userEmail.split('@')[0]}.bat`;
fs.writeFileSync(outputPath, agentContent);

console.log(`✅ User-specific agent generated: ${outputPath}`);
console.log(`📊 File size: ${fs.statSync(outputPath).size} bytes`);

// Verify the generated agent
console.log('\n🔍 Verification:');
console.log(`   ✅ User Email: ${agentContent.includes(userEmail) ? 'Found' : 'Missing'}`);
console.log(`   ✅ API Key: ${agentContent.includes(apiKey) ? 'Found' : 'Missing'}`);
console.log(`   ✅ Production URL: ${agentContent.includes('https://secure-habit-backend.onrender.com') ? 'Found' : 'Missing'}`);

console.log('\n🚀 Ready for download and execution!');
console.log(`   File: ${outputPath}`);
console.log('   Instructions:');
console.log('   1. Download this file');
console.log('   2. Right-click → "Run as administrator"');
console.log('   3. Click "Yes" when Windows UAC prompts');
console.log('   4. Wait 2-5 minutes for scan completion');