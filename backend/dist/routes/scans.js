"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Scan_1 = __importDefault(require("../models/Scan"));
const Agent_1 = __importDefault(require("../models/Agent"));
const auth_1 = require("../middleware/auth");
const vulnerabilityAnalyzer_1 = require("../utils/vulnerabilityAnalyzer");
const scoreCalculator_1 = require("../utils/scoreCalculator");
const recommendationEngine_1 = require("../services/recommendationEngine");
const User_1 = __importDefault(require("../models/User"));
const router = express_1.default.Router();
// Submit scan (from PowerShell script)
router.post('/submit', auth_1.authenticateApiKey, async (req, res) => {
    try {
        console.log('=== SCAN SUBMISSION DEBUG ===');
        console.log('Headers:', {
            authorization: req.headers.authorization ? 'Present' : 'Missing',
            userEmail: req.headers['x-user-email'],
            contentType: req.headers['content-type'],
            userAgent: req.headers['user-agent']
        });
        console.log('Body keys:', Object.keys(req.body));
        console.log('Raw body preview:', JSON.stringify(req.body).substring(0, 500));
        const { deviceId, scanTimestamp, systemInfo, software, browserExtensions, patches, } = req.body;
        // Enhanced validation with detailed error messages
        if (!deviceId) {
            console.error('Missing deviceId in request');
            return res.status(400).json({
                success: false,
                message: 'Missing required field: deviceId',
                received: { deviceId: !!deviceId, scanTimestamp: !!scanTimestamp, systemInfo: !!systemInfo }
            });
        }
        if (!scanTimestamp) {
            console.error('Missing scanTimestamp in request');
            return res.status(400).json({
                success: false,
                message: 'Missing required field: scanTimestamp',
                received: { deviceId: !!deviceId, scanTimestamp: !!scanTimestamp, systemInfo: !!systemInfo }
            });
        }
        if (!systemInfo) {
            console.error('Missing systemInfo in request');
            return res.status(400).json({
                success: false,
                message: 'Missing required field: systemInfo',
                received: { deviceId: !!deviceId, scanTimestamp: !!scanTimestamp, systemInfo: !!systemInfo }
            });
        }
        // Validate and normalize arrays with detailed logging
        const softwareArray = Array.isArray(software) ? software : (software ? [software] : []);
        const browserExtensionsArray = Array.isArray(browserExtensions) ? browserExtensions : (browserExtensions ? [browserExtensions] : []);
        console.log(`=== SCAN DATA VALIDATION ===`);
        console.log(`Device ID: ${deviceId}`);
        console.log(`User: ${req.user.email}`);
        console.log(`Timestamp: ${scanTimestamp}`);
        console.log(`System: ${systemInfo.osName} ${systemInfo.osVersion}`);
        console.log(`Software items received: ${softwareArray.length}`);
        console.log(`Browser extensions received: ${browserExtensionsArray.length}`);
        console.log(`Patches info: ${patches ? 'Present' : 'Missing'}`);
        // Log software validation
        if (softwareArray.length === 0) {
            console.warn(`⚠️ WARNING: No software items received from device ${deviceId}`);
            console.warn('This may indicate a PowerShell collection issue');
        }
        else {
            console.log(`✅ Software collection successful: ${softwareArray.length} items`);
            console.log(`First few software items:`);
            softwareArray.slice(0, 3).forEach((sw, index) => {
                if (sw && sw.name) {
                    console.log(`  ${index + 1}. ${sw.name} v${sw.version || 'Unknown'} (${sw.publisher || 'Unknown'})`);
                }
                else {
                    console.log(`  ${index + 1}. Invalid software object:`, sw);
                }
            });
        }
        // Validate timestamp format
        let parsedTimestamp;
        try {
            parsedTimestamp = new Date(scanTimestamp);
            if (isNaN(parsedTimestamp.getTime())) {
                throw new Error('Invalid timestamp format');
            }
        }
        catch (error) {
            console.error('Invalid timestamp format:', scanTimestamp);
            return res.status(400).json({
                success: false,
                message: 'Invalid timestamp format. Expected ISO 8601 format.',
                received: scanTimestamp
            });
        }
        // Create scan with enhanced error handling
        const scan = new Scan_1.default({
            userId: req.userId,
            userEmail: req.user.email,
            deviceId,
            scanTimestamp: parsedTimestamp,
            systemInfo,
            software: softwareArray,
            browserExtensions: browserExtensionsArray,
            patches: {
                totalPatches: patches?.totalPatches || 0,
                latestPatchId: patches?.latestPatchId || '',
                latestPatchDate: patches?.latestPatchDate ? new Date(patches.latestPatchDate) : new Date(),
            },
            status: 'analyzing',
        });
        await scan.save();
        console.log(`✅ Scan saved successfully with ID: ${scan._id}`);
        console.log(`✅ Scan data: ${softwareArray.length} software, ${browserExtensionsArray.length} extensions`);
        // Analyze vulnerabilities asynchronously with enhanced error handling
        setTimeout(async () => {
            try {
                console.log(`Starting vulnerability analysis for scan ${scan._id}...`);
                const vulnerabilities = (0, vulnerabilityAnalyzer_1.analyzeVulnerabilities)(scan);
                const endpointExposureScore = (0, scoreCalculator_1.calculateEndpointExposureScore)({
                    ...scan.toObject(),
                    vulnerabilities,
                });
                const currentUser = await User_1.default.findById(req.userId);
                const userScans = await Scan_1.default.find({ userId: req.userId });
                // Calculate secure score with the new scan included
                const allScans = [...userScans, { ...scan.toObject(), vulnerabilities }];
                const secureScore = (0, scoreCalculator_1.calculateUserSecureScore)(allScans, currentUser);
                // Ensure scores are valid numbers
                const validSecureScore = isNaN(secureScore) ? 50 : Math.max(0, Math.min(100, secureScore));
                const validEndpointScore = isNaN(endpointExposureScore) ? 100 : Math.max(0, Math.min(100, endpointExposureScore));
                // Update scan with analysis results
                const updatedScan = await Scan_1.default.findByIdAndUpdate(scan._id, {
                    vulnerabilities,
                    endpointExposureScore: validEndpointScore,
                    secureScore: validSecureScore,
                    status: 'completed',
                    analyzedAt: new Date()
                }, { new: true });
                // Update user onboarding state and agent status after successful scan
                const updatedUser = await User_1.default.findByIdAndUpdate(req.userId, {
                    hasScanned: true,
                    securityScore: validSecureScore,
                    lastScoreUpdate: new Date()
                }, { new: true });
                // Update agent state: connected → active (after first successful scan)
                const agent = await Agent_1.default.findOneAndUpdate({ userId: req.userId, deviceId }, {
                    status: 'active', // Agent becomes active after successful scan
                    lastScan: new Date(),
                    firstScanCompleted: true,
                }, { new: true });
                if (agent) {
                    console.log(`Agent state updated: ${deviceId} → active (first scan completed)`);
                }
                console.log(`✅ Scan analysis completed for device ${deviceId}:`);
                console.log(`- Software analyzed: ${softwareArray.length}`);
                console.log(`- Vulnerabilities found: ${vulnerabilities.total}`);
                console.log(`- Secure Score: ${validSecureScore}`);
                console.log(`- Endpoint Score: ${validEndpointScore}`);
                console.log(`- User onboarding state updated: hasScanned = true`);
                console.log(`- Agent status: ${agent?.status || 'not found'}`);
                // Generate security recommendations based on scan results
                if (updatedScan && updatedUser) {
                    try {
                        console.log('Generating security recommendations...');
                        const recommendations = await recommendationEngine_1.recommendationEngine.generateRecommendations({
                            scan: updatedScan,
                            user: updatedUser
                        });
                        // Save recommendations to database
                        await recommendationEngine_1.recommendationEngine.saveRecommendations(recommendations, req.userId, req.user.email, deviceId);
                        console.log(`✅ Generated and saved ${recommendations.length} security recommendations`);
                    }
                    catch (recError) {
                        console.error('Error generating recommendations:', recError);
                    }
                }
            }
            catch (error) {
                console.error('❌ Error analyzing scan:', error);
                await Scan_1.default.findByIdAndUpdate(scan._id, {
                    status: 'completed',
                    secureScore: 50,
                    endpointExposureScore: 100,
                    vulnerabilities: {
                        total: 0,
                        critical: 0,
                        high: 0,
                        medium: 0,
                        low: 0,
                        exploitable: 0,
                        items: []
                    }
                });
            }
        }, 2000); // Simulate analysis delay
        // Return success response with detailed information
        const response = {
            success: true,
            scanId: scan._id,
            message: 'Scan submitted successfully. Analysis in progress.',
            data: {
                softwareCount: softwareArray.length,
                browserExtensionsCount: browserExtensionsArray.length,
                deviceId: deviceId,
                timestamp: parsedTimestamp.toISOString(),
                estimatedAnalysisTime: '30-60 seconds'
            },
            // Legacy format for compatibility
            softwareCount: softwareArray.length,
            browserExtensionsCount: browserExtensionsArray.length
        };
        console.log('✅ Sending success response:', response);
        res.json(response);
    }
    catch (error) {
        console.error('❌ Critical error in scan submission:', error);
        console.error('Stack trace:', error.stack);
        // Return detailed error for debugging
        res.status(500).json({
            success: false,
            message: error.message || 'Error submitting scan',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
    }
});
// Get all scans
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const deviceId = req.query.deviceId;
        const query = { userId: req.userId };
        if (deviceId) {
            query.deviceId = deviceId;
        }
        const scans = await Scan_1.default.find(query)
            .sort({ scanTimestamp: -1 })
            .limit(limit)
            .lean();
        const totalScans = await Scan_1.default.countDocuments(query);
        res.json({
            success: true,
            scans,
            totalScans,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching scans',
        });
    }
});
// Get scan status by ID
router.get('/:scanId/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const scan = await Scan_1.default.findOne({
            _id: req.params.scanId,
            userId: req.userId,
        }).select('status scanTimestamp analyzedAt vulnerabilities');
        if (!scan) {
            return res.status(404).json({
                success: false,
                message: 'Scan not found',
            });
        }
        // Calculate progress based on status and time elapsed
        let progress = 0;
        const now = new Date();
        const scanTime = new Date(scan.scanTimestamp);
        const elapsedMinutes = (now.getTime() - scanTime.getTime()) / (1000 * 60);
        switch (scan.status) {
            case 'pending':
                progress = 0;
                break;
            case 'analyzing':
                // Progress based on time elapsed (max 95% until completed)
                progress = Math.min(95, elapsedMinutes * 20); // 20% per minute
                break;
            case 'completed':
                progress = 100;
                break;
            case 'failed':
                progress = 0;
                break;
            default:
                progress = 0;
        }
        res.json({
            success: true,
            status: scan.status,
            progress: Math.round(progress),
            scanTimestamp: scan.scanTimestamp,
            analyzedAt: scan.analyzedAt,
            vulnerabilityCount: scan.vulnerabilities?.total || 0,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching scan status',
        });
    }
});
// Get scan by ID
router.get('/:scanId', auth_1.authenticateToken, async (req, res) => {
    try {
        const scan = await Scan_1.default.findOne({
            _id: req.params.scanId,
            userId: req.userId,
        });
        if (!scan) {
            return res.status(404).json({
                success: false,
                message: 'Scan not found',
            });
        }
        res.json({
            success: true,
            scan,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching scan',
        });
    }
});
exports.default = router;
