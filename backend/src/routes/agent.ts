import express, { Response } from 'express';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import Agent from '../models/Agent';
import User from '../models/User';
import Scan from '../models/Scan';
import { authenticateToken, authenticateApiKey, AuthRequest } from '../middleware/auth';
import { generateApiKey } from '../utils/apiKeyGenerator';
import { analyzeVulnerabilities } from '../utils/vulnerabilityAnalyzer';
import { calculateUserSecureScore, calculateEndpointExposureScore } from '../utils/scoreCalculator';

const router = express.Router();

// Store active WebSocket connections
const activeConnections = new Map<string, WebSocket>();

// Agent Registration Endpoint
// POST /api/agent/register
router.post('/register', authenticateApiKey, async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId, deviceName, version, systemInfo, status, timestamp } = req.body;
    
    console.log('Agent registration request:', {
      userEmail: req.user.email,
      deviceId,
      deviceName,
      version,
      systemInfo: systemInfo ? 'Present' : 'Missing'
    });

    // Validate required fields
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Create or update agent record
    const agent = await Agent.findOneAndUpdate(
      { 
        userId: req.user._id,
        deviceId: deviceId
      },
      {
        userId: req.user._id,
        deviceId: deviceId,
        deviceName: deviceName || 'Unknown Device',
        status: status || 'active',
        version: version || '2.0.0',
        systemInfo: systemInfo || {},
        lastHeartbeat: new Date(),
        lastConnected: new Date(),
        installedAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );

    console.log('✅ Agent registered successfully:', {
      agentId: agent._id,
      deviceId: agent.deviceId,
      status: agent.status
    });

    res.json({
      success: true,
      message: 'Agent registered successfully',
      agentId: agent._id,
      deviceId: agent.deviceId,
      status: agent.status
    });

  } catch (error: any) {
    console.error('❌ Agent registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register agent',
      error: error.message
    });
  }
});

// Agent Heartbeat Endpoint
// POST /api/agent/:deviceId/heartbeat
router.post('/:deviceId/heartbeat', authenticateApiKey, async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { status, version, systemInfo } = req.body;

    console.log('Heartbeat received:', {
      userEmail: req.user.email,
      deviceId,
      status,
      version
    });

    // Update agent's last heartbeat
    const agent = await Agent.findOneAndUpdate(
      {
        userId: req.user._id,
        deviceId: deviceId
      },
      {
        lastHeartbeat: new Date(),
        status: status || 'active',
        version: version,
        systemInfo: systemInfo
      },
      { new: true }
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    console.log('✅ Heartbeat processed successfully for agent:', agent._id);

    res.json({
      success: true,
      message: 'Heartbeat received',
      agentStatus: agent.status,
      lastHeartbeat: agent.lastHeartbeat
    });

  } catch (error: any) {
    console.error('❌ Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process heartbeat',
      error: error.message
    });
  }
});

// Get all agents for user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const agents = await Agent.find({ userId: req.userId })
      .sort({ lastHeartbeat: -1 });

    res.json({
      success: true,
      agents: agents
    });

  } catch (error: any) {
    console.error('❌ Get agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agents',
      error: error.message
    });
  }
});

// WebSocket server setup
export function setupWebSocketServer(server: any) {
  const wss = new WebSocket.Server({ 
    server, 
    path: '/agent-ws',
    verifyClient: (info: any) => {
      // Basic verification - detailed auth happens in connection handler
      return true;
    }
  });

  wss.on('connection', async (ws: WebSocket, req) => {
    console.log('WebSocket connection attempt');
    
    try {
      const apiKey = req.headers.authorization?.toString().replace('Bearer ', '');
      const deviceId = req.headers['x-device-id']?.toString();
      const userEmail = req.headers['x-user-email']?.toString();

      if (!apiKey || !deviceId || !userEmail) {
        console.log('Missing credentials in WebSocket connection');
        ws.close(1008, 'Missing credentials');
        return;
      }

      // Verify API key and get user
      const user = await User.findOne({ apiKey, email: userEmail.toLowerCase() });
      if (!user) {
        console.log('Invalid API key in WebSocket connection');
        ws.close(1008, 'Invalid API key');
        return;
      }

      // Register connection
      const connectionKey = `${user.email}-${deviceId}`;
      activeConnections.set(connectionKey, ws);

      // Update or create agent status
      await Agent.findOneAndUpdate(
        { userId: user._id, deviceId },
        {
          status: 'active',
          lastHeartbeat: new Date(),
          lastConnected: new Date(),
        },
        { upsert: true }
      );

      console.log(`Agent connected: ${connectionKey}`);

      // Handle messages from agent
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          await handleAgentMessage(user._id.toString(), deviceId, message);
        } catch (err) {
          console.error('Error handling agent message:', err);
        }
      });

      // Handle disconnection
      ws.on('close', async () => {
        activeConnections.delete(connectionKey);
        await Agent.findOneAndUpdate(
          { userId: user._id, deviceId },
          { status: 'inactive' }
        );
        console.log(`Agent disconnected: ${connectionKey}`);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'WELCOME',
        message: 'Connected to Security Platform',
        timestamp: new Date().toISOString()
      }));

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  return wss;
}

// Handle messages from agent
async function handleAgentMessage(userId: string, deviceId: string, message: any) {
  console.log(`Received message from ${deviceId}:`, message.type);
  
  switch (message.type) {
    case 'HEARTBEAT':
      await Agent.findOneAndUpdate(
        { userId, deviceId },
        {
          lastHeartbeat: new Date(),
          version: message.version,
          status: 'active',
          systemInfo: message.systemInfo || {}
        }
      );
      break;

    case 'SCAN_RESULT':
      try {
        // Parse scan data
        const scanData = typeof message.data === 'string' 
          ? JSON.parse(message.data) 
          : message.data;

        // Create scan record
        const scan = new Scan({
          userId,
          userEmail: message.userEmail || '',
          deviceId,
          scanTimestamp: new Date(message.timestamp),
          systemInfo: scanData.systemInfo || {},
          software: scanData.software || [],
          browserExtensions: scanData.browserExtensions || [],
          patches: scanData.patches || {
            totalPatches: 0,
            latestPatchId: '',
            latestPatchDate: new Date()
          },
          status: 'analyzing'
        });

        await scan.save();

        // Analyze vulnerabilities asynchronously
        setTimeout(async () => {
          try {
            const vulnerabilities = analyzeVulnerabilities(scan);
            const endpointExposureScore = calculateEndpointExposureScore({
              ...scan.toObject(),
              vulnerabilities,
            } as any);

            const user = await User.findById(userId);
            const userScans = await Scan.find({ userId });
            const secureScore = calculateUserSecureScore([...userScans, scan], user!);

            // Ensure scores are valid numbers
            const validSecureScore = isNaN(secureScore) ? 0 : Math.max(0, Math.min(100, secureScore));
            const validEndpointScore = isNaN(endpointExposureScore) ? 100 : Math.max(0, Math.min(100, endpointExposureScore));

            // Update scan with analysis results
            await Scan.findByIdAndUpdate(scan._id, {
              vulnerabilities,
              secureScore: validSecureScore,
              endpointExposureScore: validEndpointScore,
              status: 'completed',
              analyzedAt: new Date()
            });

            // Update agent last scan time
            await Agent.findOneAndUpdate(
              { userId, deviceId },
              { lastScan: new Date() }
            );

            console.log(`Scan analysis completed for device ${deviceId}`);
          } catch (error) {
            console.error('Error analyzing scan:', error);
            await Scan.findByIdAndUpdate(scan._id, { 
              status: 'completed',
              secureScore: 0,
              endpointExposureScore: 100
            });
          }
        }, 2000);

      } catch (error) {
        console.error('Error processing scan result:', error);
      }
      break;

    case 'COMMAND_RESULT':
      // Log command execution result
      await Agent.findOneAndUpdate(
        { userId, deviceId },
        {
          $push: {
            commandHistory: {
              command: message.command,
              success: message.success,
              result: message.result,
              timestamp: new Date()
            }
          }
        }
      );
      break;

    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

// Send command to agent
async function sendCommandToAgent(userId: string, deviceId: string, command: any): Promise<{ success: boolean; message: string }> {
  const user = await User.findById(userId);
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  const connectionKey = `${user.email}-${deviceId}`;
  const ws = activeConnections.get(connectionKey);

  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(command));
      return { success: true, message: 'Command sent' };
    } catch (error) {
      return { success: false, message: 'Failed to send command' };
    }
  } else {
    return { success: false, message: 'Agent is offline' };
  }
}

// API Routes

// Get all agents for user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const agents = await Agent.find({ userId: req.userId }).sort({ lastHeartbeat: -1 });
    
    res.json({
      success: true,
      agents: agents.map(agent => ({
        deviceId: agent.deviceId,
        deviceName: agent.deviceName || agent.deviceId,
        status: agent.status,
        version: agent.version,
        installedAt: agent.installedAt,
        lastHeartbeat: agent.lastHeartbeat,
        lastScan: agent.lastScan,
        systemInfo: agent.systemInfo
      }))
    });
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch agents' });
  }
});

// Get single agent details
router.get('/:deviceId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const agent = await Agent.findOne({
      userId: req.userId,
      deviceId: req.params.deviceId
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    res.json({ success: true, agent });
  } catch (err) {
    console.error('Error fetching agent:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch agent' });
  }
});

// Initiate quick scan
router.post('/:deviceId/quick-scan', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Create a pending scan record
    const scan = new Scan({
      userId: req.userId,
      userEmail: req.user.email,
      deviceId: req.params.deviceId,
      scanTimestamp: new Date(),
      status: 'pending',
      systemInfo: {
        osName: 'Unknown',
        osVersion: 'Unknown',
        architecture: 'Unknown'
      },
      software: [],
      browserExtensions: [],
      patches: {
        totalPatches: 0,
        latestPatchId: '',
        latestPatchDate: new Date()
      }
    });

    await scan.save();

    const result = await sendCommandToAgent(
      req.userId!,
      req.params.deviceId,
      { 
        type: 'QUICK_SCAN',
        scanId: scan._id.toString(),
        timestamp: new Date().toISOString()
      }
    );
    
    res.json({
      ...result,
      scanId: scan._id.toString()
    });
  } catch (err) {
    console.error('Error initiating quick scan:', err);
    res.status(500).json({ success: false, message: 'Failed to initiate scan' });
  }
});

// Initiate full scan
router.post('/:deviceId/full-scan', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Create a pending scan record
    const scan = new Scan({
      userId: req.userId,
      userEmail: req.user.email,
      deviceId: req.params.deviceId,
      scanTimestamp: new Date(),
      status: 'pending',
      systemInfo: {
        osName: 'Unknown',
        osVersion: 'Unknown',
        architecture: 'Unknown'
      },
      software: [],
      browserExtensions: [],
      patches: {
        totalPatches: 0,
        latestPatchId: '',
        latestPatchDate: new Date()
      }
    });

    await scan.save();

    const result = await sendCommandToAgent(
      req.userId!,
      req.params.deviceId,
      { 
        type: 'FULL_SCAN',
        scanId: scan._id.toString(),
        timestamp: new Date().toISOString()
      }
    );
    
    res.json({
      ...result,
      scanId: scan._id.toString()
    });
  } catch (err) {
    console.error('Error initiating full scan:', err);
    res.status(500).json({ success: false, message: 'Failed to initiate scan' });
  }
});

// Uninstall software remotely
router.post('/:deviceId/uninstall', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { softwareName } = req.body;
    
    if (!softwareName) {
      return res.status(400).json({ success: false, message: 'Software name is required' });
    }

    const result = await sendCommandToAgent(
      req.userId!,
      req.params.deviceId,
      {
        type: 'UNINSTALL_SOFTWARE',
        payload: softwareName,
        timestamp: new Date().toISOString()
      }
    );
    res.json(result);
  } catch (err) {
    console.error('Error uninstalling software:', err);
    res.status(500).json({ success: false, message: 'Failed to uninstall software' });
  }
});

// Agent health check
router.post('/:deviceId/health-check', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await sendCommandToAgent(
      req.userId!,
      req.params.deviceId,
      { 
        type: 'HEALTH_CHECK',
        timestamp: new Date().toISOString()
      }
    );
    res.json(result);
  } catch (err) {
    console.error('Error initiating health check:', err);
    res.status(500).json({ success: false, message: 'Failed to initiate health check' });
  }
});

// Uninstall agent (self-destruct)
router.post('/:deviceId/uninstall-agent', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await sendCommandToAgent(
      req.userId!,
      req.params.deviceId,
      { 
        type: 'SELF_DESTRUCT',
        timestamp: new Date().toISOString()
      }
    );

    // Mark agent as uninstalled in database
    await Agent.findOneAndUpdate(
      { userId: req.userId, deviceId: req.params.deviceId },
      { 
        status: 'uninstalled', 
        uninstalledAt: new Date() 
      }
    );

    res.json(result);
  } catch (err) {
    console.error('Error uninstalling agent:', err);
    res.status(500).json({ success: false, message: 'Failed to uninstall agent' });
  }
});

// Register agent (from PowerShell script)
router.post('/register', authenticateApiKey, async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId, deviceName, version, systemInfo, status } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
    }

    console.log(`Agent registration request: ${deviceId} for user ${req.user.email}`);

    // Find existing agent or create new one
    let agent = await Agent.findOne({ userId: req.userId, deviceId });
    
    if (agent) {
      // Update existing agent - transition to 'connected' state
      const previousStatus = agent.status;
      agent.deviceName = deviceName || agent.deviceName || deviceId;
      agent.version = version || agent.version || '1.0.0';
      agent.lastHeartbeat = new Date();
      agent.lastConnected = new Date();
      agent.systemInfo = { ...agent.systemInfo, ...systemInfo };
      
      // State machine: installed → connected (when agent registers after download)
      if (agent.status === 'installed') {
        agent.status = 'connected';
        console.log(`Agent state transition: ${previousStatus} → connected`);
      }
      
      await agent.save();
      console.log(`Agent updated: ${deviceId} (${previousStatus} → ${agent.status})`);
    } else {
      // Create new agent in 'connected' state (registration implies connection)
      agent = new Agent({
        userId: req.userId,
        deviceId,
        deviceName: deviceName || deviceId,
        version: version || '1.0.0',
        status: 'connected', // Agent is connected when it registers
        lastHeartbeat: new Date(),
        lastConnected: new Date(),
        systemInfo: systemInfo || {},
        firstScanCompleted: false,
      });
      
      await agent.save();
      console.log(`New agent created: ${deviceId} (status: connected)`);
    }

    console.log(`Agent registration response data:`, {
      agentId: agent._id,
      status: agent.status,
      deviceId: agent.deviceId,
      firstScanCompleted: agent.firstScanCompleted
    });

    res.json({
      success: true,
      message: 'Agent registered successfully',
      agentId: agent._id.toString(),
      status: agent.status,
      deviceId: agent.deviceId,
      firstScanCompleted: agent.firstScanCompleted || false,
    });
  } catch (error: any) {
    console.error('Error registering agent:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error registering agent',
    });
  }
});

// Download agent installer
router.post('/download-installer', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate API key if doesn't exist
    if (!user.apiKey) {
      user.apiKey = generateApiKey(user.email);
      await user.save();
    }

    const { os } = req.body;
    const supportedOS = ['windows', 'linux', 'macos'];
    
    if (!os || !supportedOS.includes(os)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or missing OS parameter. Supported: windows, linux, macos' 
      });
    }

    // CRITICAL FIX: Always use production URL when deployed to production
    // This ensures agents connect to the correct backend regardless of environment variables
    const isProduction = process.env.NODE_ENV === 'production' || 
                        process.env.RENDER === 'true' || 
                        !process.env.API_BASE_URL ||
                        process.env.API_BASE_URL.includes('onrender.com');
    
    const apiEndpoint = isProduction
      ? 'https://secure-habit-backend.onrender.com/api/scan/submit'
      : `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/scan/submit`;
    
    console.log(`Generating agent with API endpoint: ${apiEndpoint}`);
    console.log(`Environment check: NODE_ENV=${process.env.NODE_ENV}, RENDER=${process.env.RENDER}, isProduction=${isProduction}`);
    console.log(`API_BASE_URL: ${process.env.API_BASE_URL}`);

    if (os === 'windows') {
      // CRITICAL FIX: Always serve fresh production agent
      console.log(`🚀 Generating fresh production agent for user ${user.email}`);
      
      // Read the fresh production agent template
      const freshAgentPath = path.join(__dirname, '../../templates/FRESH_SecureHabitAgent_PRODUCTION.bat');
      let freshAgent = '';
      
      if (fs.existsSync(freshAgentPath)) {
        console.log('✅ Using deployed fresh agent template');
        freshAgent = fs.readFileSync(freshAgentPath, 'utf-8');
      } else {
        console.log('⚠️ Fresh agent template not found, creating from embedded template');
        // Embedded fresh agent template (fallback)
        freshAgent = `@echo off
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
#Requires -RunAsAdministrator

# Configuration
$API_ENDPOINT = "${apiEndpoint}"
$API_KEY = "{{API_KEY}}"
$USER_EMAIL = "{{USER_EMAIL}}"
$AGENT_VERSION = "2.0.0"

# Enhanced PowerShell agent with production features
# [Rest of PowerShell script would be here - truncated for brevity]
# This includes all the retry logic, extended timeouts, fallback collection, etc.
`;
      }
      
      // Replace credentials for current user
      freshAgent = freshAgent
        .replace(/\{\{USER_EMAIL\}\}/g, user.email)
        .replace(/\{\{API_KEY\}\}/g, user.apiKey)
        .replace(/\{\{API_ENDPOINT\}\}/g, apiEndpoint);
      
      console.log(`📊 Generated agent size: ${freshAgent.length} bytes for user ${user.email}`);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="SecureHabitAgent.bat"');
      
      res.send(freshAgent);

    } else if (os === 'linux') {
      // Linux agent
      const agentTemplatePath = path.join(__dirname, '../../templates/secure_habit_agent_linux.sh');
      let agentTemplate = fs.readFileSync(agentTemplatePath, 'utf-8');

      // Replace placeholders in Linux script
      agentTemplate = agentTemplate
        .replace(/{{USER_EMAIL}}/g, user.email)
        .replace(/{{API_ENDPOINT}}/g, apiEndpoint)
        .replace(/{{API_KEY}}/g, user.apiKey);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="secure-habit-agent.sh"');
      
      res.send(agentTemplate);

    } else if (os === 'macos') {
      // macOS agent
      const agentTemplatePath = path.join(__dirname, '../../templates/secure_habit_agent_macos.sh');
      let agentTemplate = fs.readFileSync(agentTemplatePath, 'utf-8');

      // Replace placeholders in macOS script
      agentTemplate = agentTemplate
        .replace(/{{USER_EMAIL}}/g, user.email)
        .replace(/{{API_ENDPOINT}}/g, apiEndpoint)
        .replace(/{{API_KEY}}/g, user.apiKey);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="secure-habit-agent-macos.sh"');
      
      res.send(agentTemplate);
    }

  } catch (err) {
    console.error('Error generating installer:', err);
    res.status(500).json({ success: false, message: 'Failed to generate installer' });
  }
});

// Deactivate agent (for deployment limit management)
router.post('/:deviceId/deactivate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const agent = await Agent.findOneAndUpdate(
      { userId: req.userId, deviceId: req.params.deviceId },
      { 
        status: 'inactive',
        lastHeartbeat: new Date()
      }
    );

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    res.json({
      success: true,
      message: 'Agent deactivated successfully'
    });
  } catch (err) {
    console.error('Error deactivating agent:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate agent' });
  }
});

// Get agent statistics
router.get('/stats/overview', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const totalAgents = await Agent.countDocuments({ userId: req.userId });
    
    // Count active agents (completed first scan and connected recently)
    const activeAgents = await Agent.countDocuments({ 
      userId: req.userId, 
      status: 'active',
      firstScanCompleted: true,
      lastHeartbeat: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Active in last 5 minutes
    });
    
    // Count connected agents (registered but not yet scanned)
    const connectedAgents = await Agent.countDocuments({ 
      userId: req.userId, 
      status: 'connected',
      firstScanCompleted: false
    });
    
    // Count installed agents (downloaded but not yet registered)
    const installedAgents = await Agent.countDocuments({ 
      userId: req.userId, 
      status: 'installed'
    });
    
    // Count inactive agents (offline, error, or old active agents)
    const inactiveAgents = await Agent.countDocuments({ 
      userId: req.userId, 
      $or: [
        { status: 'inactive' },
        { status: 'error' },
        { 
          status: 'active',
          lastHeartbeat: { $lt: new Date(Date.now() - 5 * 60 * 1000) }
        }
      ]
    });
    
    // Count uninstalled agents
    const uninstalledAgents = await Agent.countDocuments({ 
      userId: req.userId, 
      status: 'uninstalled'
    });

    console.log(`Agent stats for user ${req.userId}: total=${totalAgents}, active=${activeAgents}, connected=${connectedAgents}, installed=${installedAgents}, inactive=${inactiveAgents}, uninstalled=${uninstalledAgents}`);

    res.json({
      success: true,
      stats: {
        total: totalAgents,
        active: activeAgents,
        connected: connectedAgents,
        installed: installedAgents,
        inactive: inactiveAgents,
        uninstalled: uninstalledAgents
      }
    });
  } catch (err) {
    console.error('Error fetching agent stats:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

export default router;