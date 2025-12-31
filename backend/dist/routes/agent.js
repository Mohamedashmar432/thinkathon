"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocketServer = setupWebSocketServer;
const express_1 = __importDefault(require("express"));
const ws_1 = __importDefault(require("ws"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const Agent_1 = __importDefault(require("../models/Agent"));
const User_1 = __importDefault(require("../models/User"));
const Scan_1 = __importDefault(require("../models/Scan"));
const auth_1 = require("../middleware/auth");
const apiKeyGenerator_1 = require("../utils/apiKeyGenerator");
const vulnerabilityAnalyzer_1 = require("../utils/vulnerabilityAnalyzer");
const scoreCalculator_1 = require("../utils/scoreCalculator");
const router = express_1.default.Router();
// Store active WebSocket connections
const activeConnections = new Map();
// WebSocket server setup
function setupWebSocketServer(server) {
    const wss = new ws_1.default.Server({
        server,
        path: '/agent-ws',
        verifyClient: (info) => {
            // Basic verification - detailed auth happens in connection handler
            return true;
        }
    });
    wss.on('connection', async (ws, req) => {
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
            const user = await User_1.default.findOne({ apiKey, email: userEmail.toLowerCase() });
            if (!user) {
                console.log('Invalid API key in WebSocket connection');
                ws.close(1008, 'Invalid API key');
                return;
            }
            // Register connection
            const connectionKey = `${user.email}-${deviceId}`;
            activeConnections.set(connectionKey, ws);
            // Update or create agent status
            await Agent_1.default.findOneAndUpdate({ userId: user._id, deviceId }, {
                status: 'active',
                lastHeartbeat: new Date(),
                lastConnected: new Date(),
            }, { upsert: true });
            console.log(`Agent connected: ${connectionKey}`);
            // Handle messages from agent
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await handleAgentMessage(user._id.toString(), deviceId, message);
                }
                catch (err) {
                    console.error('Error handling agent message:', err);
                }
            });
            // Handle disconnection
            ws.on('close', async () => {
                activeConnections.delete(connectionKey);
                await Agent_1.default.findOneAndUpdate({ userId: user._id, deviceId }, { status: 'inactive' });
                console.log(`Agent disconnected: ${connectionKey}`);
            });
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'WELCOME',
                message: 'Connected to Security Platform',
                timestamp: new Date().toISOString()
            }));
        }
        catch (error) {
            console.error('WebSocket connection error:', error);
            ws.close(1011, 'Internal server error');
        }
    });
    return wss;
}
// Handle messages from agent
async function handleAgentMessage(userId, deviceId, message) {
    console.log(`Received message from ${deviceId}:`, message.type);
    switch (message.type) {
        case 'HEARTBEAT':
            await Agent_1.default.findOneAndUpdate({ userId, deviceId }, {
                lastHeartbeat: new Date(),
                version: message.version,
                status: 'active',
                systemInfo: message.systemInfo || {}
            });
            break;
        case 'SCAN_RESULT':
            try {
                // Parse scan data
                const scanData = typeof message.data === 'string'
                    ? JSON.parse(message.data)
                    : message.data;
                // Create scan record
                const scan = new Scan_1.default({
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
                        const vulnerabilities = (0, vulnerabilityAnalyzer_1.analyzeVulnerabilities)(scan);
                        const endpointExposureScore = (0, scoreCalculator_1.calculateEndpointExposureScore)({
                            ...scan.toObject(),
                            vulnerabilities,
                        });
                        const user = await User_1.default.findById(userId);
                        const userScans = await Scan_1.default.find({ userId });
                        const secureScore = (0, scoreCalculator_1.calculateUserSecureScore)([...userScans, scan], user);
                        // Ensure scores are valid numbers
                        const validSecureScore = isNaN(secureScore) ? 0 : Math.max(0, Math.min(100, secureScore));
                        const validEndpointScore = isNaN(endpointExposureScore) ? 100 : Math.max(0, Math.min(100, endpointExposureScore));
                        // Update scan with analysis results
                        await Scan_1.default.findByIdAndUpdate(scan._id, {
                            vulnerabilities,
                            secureScore: validSecureScore,
                            endpointExposureScore: validEndpointScore,
                            status: 'completed',
                            analyzedAt: new Date()
                        });
                        // Update agent last scan time
                        await Agent_1.default.findOneAndUpdate({ userId, deviceId }, { lastScan: new Date() });
                        console.log(`Scan analysis completed for device ${deviceId}`);
                    }
                    catch (error) {
                        console.error('Error analyzing scan:', error);
                        await Scan_1.default.findByIdAndUpdate(scan._id, {
                            status: 'completed',
                            secureScore: 0,
                            endpointExposureScore: 100
                        });
                    }
                }, 2000);
            }
            catch (error) {
                console.error('Error processing scan result:', error);
            }
            break;
        case 'COMMAND_RESULT':
            // Log command execution result
            await Agent_1.default.findOneAndUpdate({ userId, deviceId }, {
                $push: {
                    commandHistory: {
                        command: message.command,
                        success: message.success,
                        result: message.result,
                        timestamp: new Date()
                    }
                }
            });
            break;
        default:
            console.log(`Unknown message type: ${message.type}`);
    }
}
// Send command to agent
async function sendCommandToAgent(userId, deviceId, command) {
    const user = await User_1.default.findById(userId);
    if (!user) {
        return { success: false, message: 'User not found' };
    }
    const connectionKey = `${user.email}-${deviceId}`;
    const ws = activeConnections.get(connectionKey);
    if (ws && ws.readyState === ws_1.default.OPEN) {
        try {
            ws.send(JSON.stringify(command));
            return { success: true, message: 'Command sent' };
        }
        catch (error) {
            return { success: false, message: 'Failed to send command' };
        }
    }
    else {
        return { success: false, message: 'Agent is offline' };
    }
}
// API Routes
// Get all agents for user
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const agents = await Agent_1.default.find({ userId: req.userId }).sort({ lastHeartbeat: -1 });
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
    }
    catch (err) {
        console.error('Error fetching agents:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch agents' });
    }
});
// Get single agent details
router.get('/:deviceId', auth_1.authenticateToken, async (req, res) => {
    try {
        const agent = await Agent_1.default.findOne({
            userId: req.userId,
            deviceId: req.params.deviceId
        });
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }
        res.json({ success: true, agent });
    }
    catch (err) {
        console.error('Error fetching agent:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch agent' });
    }
});
// Initiate quick scan
router.post('/:deviceId/quick-scan', auth_1.authenticateToken, async (req, res) => {
    try {
        // Create a pending scan record
        const scan = new Scan_1.default({
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
        const result = await sendCommandToAgent(req.userId, req.params.deviceId, {
            type: 'QUICK_SCAN',
            scanId: scan._id.toString(),
            timestamp: new Date().toISOString()
        });
        res.json({
            ...result,
            scanId: scan._id.toString()
        });
    }
    catch (err) {
        console.error('Error initiating quick scan:', err);
        res.status(500).json({ success: false, message: 'Failed to initiate scan' });
    }
});
// Initiate full scan
router.post('/:deviceId/full-scan', auth_1.authenticateToken, async (req, res) => {
    try {
        // Create a pending scan record
        const scan = new Scan_1.default({
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
        const result = await sendCommandToAgent(req.userId, req.params.deviceId, {
            type: 'FULL_SCAN',
            scanId: scan._id.toString(),
            timestamp: new Date().toISOString()
        });
        res.json({
            ...result,
            scanId: scan._id.toString()
        });
    }
    catch (err) {
        console.error('Error initiating full scan:', err);
        res.status(500).json({ success: false, message: 'Failed to initiate scan' });
    }
});
// Uninstall software remotely
router.post('/:deviceId/uninstall', auth_1.authenticateToken, async (req, res) => {
    try {
        const { softwareName } = req.body;
        if (!softwareName) {
            return res.status(400).json({ success: false, message: 'Software name is required' });
        }
        const result = await sendCommandToAgent(req.userId, req.params.deviceId, {
            type: 'UNINSTALL_SOFTWARE',
            payload: softwareName,
            timestamp: new Date().toISOString()
        });
        res.json(result);
    }
    catch (err) {
        console.error('Error uninstalling software:', err);
        res.status(500).json({ success: false, message: 'Failed to uninstall software' });
    }
});
// Agent health check
router.post('/:deviceId/health-check', auth_1.authenticateToken, async (req, res) => {
    try {
        const result = await sendCommandToAgent(req.userId, req.params.deviceId, {
            type: 'HEALTH_CHECK',
            timestamp: new Date().toISOString()
        });
        res.json(result);
    }
    catch (err) {
        console.error('Error initiating health check:', err);
        res.status(500).json({ success: false, message: 'Failed to initiate health check' });
    }
});
// Uninstall agent (self-destruct)
router.post('/:deviceId/uninstall-agent', auth_1.authenticateToken, async (req, res) => {
    try {
        const result = await sendCommandToAgent(req.userId, req.params.deviceId, {
            type: 'SELF_DESTRUCT',
            timestamp: new Date().toISOString()
        });
        // Mark agent as uninstalled in database
        await Agent_1.default.findOneAndUpdate({ userId: req.userId, deviceId: req.params.deviceId }, {
            status: 'uninstalled',
            uninstalledAt: new Date()
        });
        res.json(result);
    }
    catch (err) {
        console.error('Error uninstalling agent:', err);
        res.status(500).json({ success: false, message: 'Failed to uninstall agent' });
    }
});
// Register agent (from PowerShell script)
router.post('/register', auth_1.authenticateApiKey, async (req, res) => {
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
        let agent = await Agent_1.default.findOne({ userId: req.userId, deviceId });
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
        }
        else {
            // Create new agent in 'connected' state (registration implies connection)
            agent = new Agent_1.default({
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
    }
    catch (error) {
        console.error('Error registering agent:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error registering agent',
        });
    }
});
// Download agent installer
router.post('/download-installer', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Generate API key if doesn't exist
        if (!user.apiKey) {
            user.apiKey = (0, apiKeyGenerator_1.generateApiKey)(user.email);
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
        const apiEndpoint = process.env.NODE_ENV === 'production'
            ? 'https://secure-habit-backend.onrender.com/api/scan/submit'
            : `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/scan/submit`;
        console.log(`Generating agent with API endpoint: ${apiEndpoint} (NODE_ENV: ${process.env.NODE_ENV})`);
        console.log(`Production mode: ${process.env.NODE_ENV === 'production'}`);
        console.log(`API_BASE_URL: ${process.env.API_BASE_URL}`);
        if (os === 'windows') {
            // CRITICAL FIX: Use fresh production agent instead of template
            // Check if fresh production agent exists in templates directory
            const freshAgentPath = path_1.default.join(__dirname, '../../templates/FRESH_SecureHabitAgent_PRODUCTION.bat');
            if (fs_1.default.existsSync(freshAgentPath)) {
                console.log(`🚀 Serving fresh production agent for user ${user.email}`);
                // Read the fresh production agent
                let freshAgent = fs_1.default.readFileSync(freshAgentPath, 'utf-8');
                // Update credentials for current user (replace the demo user credentials)
                freshAgent = freshAgent
                    .replace(/mohamedashmar123@gmail\.com/g, user.email)
                    .replace(/42627a39b74bf1cb44d801d9dc861a85f4524495cb1dc63a93712aace6a7c5f7/g, user.apiKey);
                // Set headers for file download
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Disposition', 'attachment; filename="SecureHabitAgent.bat"');
                res.send(freshAgent);
            }
            else {
                console.log(`⚠️ Fresh agent not found, generating from template for user ${user.email}`);
                // Fallback to template generation
                const agentTemplatePath = path_1.default.join(__dirname, '../../templates/secure_habit_agent.ps1');
                let agentTemplate = fs_1.default.readFileSync(agentTemplatePath, 'utf-8');
                // Replace placeholders in PowerShell script
                agentTemplate = agentTemplate
                    .replace(/{{USER_EMAIL}}/g, user.email)
                    .replace(/{{API_ENDPOINT}}/g, apiEndpoint)
                    .replace(/{{API_KEY}}/g, user.apiKey);
                // Read batch installer template
                const installerTemplatePath = path_1.default.join(__dirname, '../../templates/agent_installer.bat');
                let installerTemplate = fs_1.default.readFileSync(installerTemplatePath, 'utf-8');
                // Embed PowerShell script into batch file
                const finalInstaller = installerTemplate.replace('{{POWERSHELL_AGENT_CONTENT}}', agentTemplate);
                // Set headers for file download
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Disposition', 'attachment; filename="SecureHabitAgent.bat"');
                res.send(finalInstaller);
            }
        }
        else if (os === 'linux') {
            // Linux agent
            const agentTemplatePath = path_1.default.join(__dirname, '../../templates/secure_habit_agent_linux.sh');
            let agentTemplate = fs_1.default.readFileSync(agentTemplatePath, 'utf-8');
            // Replace placeholders in Linux script
            agentTemplate = agentTemplate
                .replace(/{{USER_EMAIL}}/g, user.email)
                .replace(/{{API_ENDPOINT}}/g, apiEndpoint)
                .replace(/{{API_KEY}}/g, user.apiKey);
            // Set headers for file download
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="secure-habit-agent.sh"');
            res.send(agentTemplate);
        }
        else if (os === 'macos') {
            // macOS agent
            const agentTemplatePath = path_1.default.join(__dirname, '../../templates/secure_habit_agent_macos.sh');
            let agentTemplate = fs_1.default.readFileSync(agentTemplatePath, 'utf-8');
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
    }
    catch (err) {
        console.error('Error generating installer:', err);
        res.status(500).json({ success: false, message: 'Failed to generate installer' });
    }
});
// Deactivate agent (for deployment limit management)
router.post('/:deviceId/deactivate', auth_1.authenticateToken, async (req, res) => {
    try {
        const agent = await Agent_1.default.findOneAndUpdate({ userId: req.userId, deviceId: req.params.deviceId }, {
            status: 'inactive',
            lastHeartbeat: new Date()
        });
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }
        res.json({
            success: true,
            message: 'Agent deactivated successfully'
        });
    }
    catch (err) {
        console.error('Error deactivating agent:', err);
        res.status(500).json({ success: false, message: 'Failed to deactivate agent' });
    }
});
// Get agent statistics
router.get('/stats/overview', auth_1.authenticateToken, async (req, res) => {
    try {
        const totalAgents = await Agent_1.default.countDocuments({ userId: req.userId });
        // Count active agents (completed first scan and connected recently)
        const activeAgents = await Agent_1.default.countDocuments({
            userId: req.userId,
            status: 'active',
            firstScanCompleted: true,
            lastHeartbeat: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Active in last 5 minutes
        });
        // Count connected agents (registered but not yet scanned)
        const connectedAgents = await Agent_1.default.countDocuments({
            userId: req.userId,
            status: 'connected',
            firstScanCompleted: false
        });
        // Count installed agents (downloaded but not yet registered)
        const installedAgents = await Agent_1.default.countDocuments({
            userId: req.userId,
            status: 'installed'
        });
        // Count inactive agents (offline, error, or old active agents)
        const inactiveAgents = await Agent_1.default.countDocuments({
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
        const uninstalledAgents = await Agent_1.default.countDocuments({
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
    }
    catch (err) {
        console.error('Error fetching agent stats:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
});
exports.default = router;
