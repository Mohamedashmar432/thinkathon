const axios = require('axios');
const fs = require('fs');

async function debugAgentEndpoint() {
  try {
    // Login and get agent
    const loginResponse = await axios.post('https://secure-habit-backend.onrender.com/api/auth/login', {
      email: 'mohamedashmar123@gmail.com',
      password: 'sudo12345'
    });
    
    const token = loginResponse.data.token;
    
    const agentResponse = await axios.post(
      'https://secure-habit-backend.onrender.com/api/agent/download-installer',
      { os: 'windows' },
      { 
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text'
      }
    );
    
    // Save agent to file
    fs.writeFileSync('debug_agent.bat', agentResponse.data);
    
    // Extract endpoint from agent
    const endpointMatch = agentResponse.data.match(/\$API_ENDPOINT = "([^"]+)"/);
    if (endpointMatch) {
      console.log('Current endpoint in agent:', endpointMatch[1]);
    } else {
      console.log('No endpoint found in agent');
    }
    
    // Check if it contains the correct endpoint
    if (agentResponse.data.includes('https://secure-habit-backend.onrender.com/api/scan/submit')) {
      console.log('✅ Agent has correct endpoint');
    } else {
      console.log('❌ Agent has incorrect endpoint');
      
      // Look for any API_ENDPOINT references
      const allEndpoints = agentResponse.data.match(/\$API_ENDPOINT = "[^"]+"/g);
      if (allEndpoints) {
        console.log('All endpoints found:', allEndpoints);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugAgentEndpoint();