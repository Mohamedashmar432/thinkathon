"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Scan_1 = __importDefault(require("../models/Scan"));
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../middleware/auth");
const scoreCalculator_1 = require("../utils/scoreCalculator");
const remediation_1 = require("../utils/remediation");
const router = express_1.default.Router();
// Demo data for unauthenticated users
const getDemoData = () => ({
    stats: {
        userSecureScore: 75,
        endpointExposureScore: 85,
        totalScans: 5,
        totalDevices: 2,
        totalVulnerabilities: 12,
        criticalVulnerabilities: 3,
        exploitableVulnerabilities: 2,
        lastScanDate: new Date().toISOString(),
        recentScans: []
    },
    timeline: [
        { date: '2024-12-25', score: 70 },
        { date: '2024-12-26', score: 72 },
        { date: '2024-12-27', score: 75 },
        { date: '2024-12-28', score: 78 },
        { date: '2024-12-29', score: 85 }
    ],
    endpoints: [
        {
            endpoint: '192.168.1.100:80',
            exposureScore: 65,
            vulnerabilities: ['CVE-2023-1234', 'CVE-2023-5678'],
            riskLevel: 'high',
            recommendation: 'Update web server to latest version'
        },
        {
            endpoint: '192.168.1.101:443',
            exposureScore: 80,
            vulnerabilities: ['CVE-2023-9999'],
            riskLevel: 'medium',
            recommendation: 'Apply security patches'
        }
    ],
    software: [
        {
            name: 'Adobe Reader',
            version: '2020.1.0',
            devicesAffected: 2,
            cveCount: 5,
            highestCVSS: 8.5,
            latestCVE: 'CVE-2023-1234',
            recommendation: 'Update Adobe Reader to latest version'
        },
        {
            name: 'Chrome Browser',
            version: '108.0.0',
            devicesAffected: 1,
            cveCount: 3,
            highestCVSS: 7.2,
            latestCVE: 'CVE-2023-5678',
            recommendation: 'Update Chrome to latest version'
        }
    ],
    insights: {
        total: 12,
        critical: 3,
        high: 4,
        medium: 3,
        low: 2,
        exploitable: 2,
        byCategory: {
            'Remote Code Execution': 3,
            'Privilege Escalation': 2,
            'Information Disclosure': 4,
            'Denial of Service': 2,
            'Cross-Site Scripting': 1
        },
        trend: {
            lastWeek: 12,
            change: -2,
            percentage: -14.3
        }
    },
    activities: [
        {
            priority: 1,
            title: 'Update Adobe Reader',
            impact: 'Fixes 5 critical vulnerabilities',
            estimatedTime: '10 minutes',
            affectedDevices: ['DESKTOP-001', 'LAPTOP-002'],
            steps: [
                'Download latest Adobe Reader',
                'Run installer as administrator',
                'Restart applications',
                'Verify update completed'
            ]
        },
        {
            priority: 2,
            title: 'Apply Windows Security Updates',
            impact: 'Patches 3 high-severity vulnerabilities',
            estimatedTime: '30 minutes',
            affectedDevices: ['DESKTOP-001'],
            steps: [
                'Open Windows Update',
                'Check for updates',
                'Install all security updates',
                'Restart computer'
            ]
        }
    ],
    checklist: {
        date: new Date().toISOString().split('T')[0],
        checklist: [
            { id: 1, task: 'OS Updated', completed: true },
            { id: 2, task: 'No High-Risk Software', completed: false },
            { id: 3, task: 'Antivirus Enabled', completed: true },
            { id: 4, task: 'No Critical CVEs', completed: false },
            { id: 5, task: 'Firewall Active', completed: true }
        ],
        completionPercentage: 60,
        streakDays: 3,
        contributionToScore: 6
    }
});
// Get dashboard stats
router.get('/stats', auth_1.optionalAuth, async (req, res) => {
    try {
        console.log('Fetching dashboard stats for user:', req.userId || 'guest');
        // If no user is authenticated, return demo data
        if (!req.userId) {
            const demoData = getDemoData();
            console.log('Returning demo stats for unauthenticated user');
            return res.json({
                success: true,
                ...demoData.stats,
                isDemo: true
            });
        }
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const scans = await Scan_1.default.find({ userId: req.userId }).sort({ scanTimestamp: -1 });
        console.log(`Found ${scans.length} scans for user`);
        // If no scans, return user's stored score (0 for new users)
        if (scans.length === 0) {
            const response = {
                success: true,
                userSecureScore: user.securityScore || 0, // Use stored score, default to 0
                endpointExposureScore: 100, // Perfect score when no vulnerabilities
                totalScans: 0,
                totalDevices: 0,
                totalVulnerabilities: 0,
                criticalVulnerabilities: 0,
                exploitableVulnerabilities: 0,
                lastScanDate: null,
                recentScans: [],
                isFirstTimeUser: !user.hasScanned, // Flag for frontend
            };
            console.log('No scans found, returning stored user score:', response);
            return res.json(response);
        }
        const latestScans = (0, scoreCalculator_1.getLatestScansPerDevice)(scans);
        console.log(`Latest scans per device: ${latestScans.length}`);
        // Calculate user secure score with proper validation
        let userSecureScore = user.securityScore || 0; // Use stored score as fallback
        try {
            const calculatedScore = (0, scoreCalculator_1.calculateUserSecureScore)(scans, user);
            userSecureScore = isNaN(calculatedScore) || calculatedScore === null || calculatedScore === undefined
                ? (user.securityScore || 0) // Fallback to stored score
                : Math.max(0, Math.min(100, Math.round(calculatedScore)));
            // Update user's stored score if it changed
            if (userSecureScore !== user.securityScore) {
                await User_1.default.findByIdAndUpdate(req.userId, {
                    securityScore: userSecureScore,
                    lastScoreUpdate: new Date(),
                    hasScanned: true // Mark user as having completed at least one scan
                });
                console.log(`Updated user security score: ${user.securityScore} → ${userSecureScore}`);
            }
        }
        catch (error) {
            console.error('Error calculating user secure score:', error);
            userSecureScore = user.securityScore || 0; // Use stored score on error
        }
        console.log('Calculated user secure score:', userSecureScore);
        const endpointExposureScore = latestScans.length > 0
            ? (0, scoreCalculator_1.calculateEndpointExposureScore)(latestScans[0])
            : 100;
        // Calculate vulnerability stats safely
        const totalVulnerabilities = scans.reduce((sum, scan) => sum + (scan.vulnerabilities?.total || 0), 0);
        const criticalVulnerabilities = scans.reduce((sum, scan) => sum + (scan.vulnerabilities?.critical || 0), 0);
        const exploitableVulnerabilities = scans.reduce((sum, scan) => sum + (scan.vulnerabilities?.exploitable || 0), 0);
        const uniqueDevices = new Set(scans.map(s => s.deviceId)).size;
        const response = {
            success: true,
            userSecureScore,
            endpointExposureScore,
            totalScans: scans.length,
            totalDevices: uniqueDevices,
            totalVulnerabilities,
            criticalVulnerabilities,
            exploitableVulnerabilities,
            lastScanDate: scans[0]?.scanTimestamp || null,
            recentScans: scans.slice(0, 5),
        };
        console.log('Dashboard stats response:', response);
        res.json(response);
    }
    catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // Return default stats on error to prevent dashboard from breaking
        const fallbackResponse = {
            success: true,
            userSecureScore: 50,
            endpointExposureScore: 100,
            totalScans: 0,
            totalDevices: 0,
            totalVulnerabilities: 0,
            criticalVulnerabilities: 0,
            exploitableVulnerabilities: 0,
            lastScanDate: null,
            recentScans: [],
        };
        console.log('Returning fallback stats due to error:', fallbackResponse);
        res.json(fallbackResponse);
    }
});
// Get endpoint exposure timeline
router.get('/endpoint-exposure-timeline', auth_1.optionalAuth, async (req, res) => {
    try {
        // If no user is authenticated, return demo data
        if (!req.userId) {
            const demoData = getDemoData();
            console.log('Returning demo timeline for unauthenticated user');
            return res.json({
                success: true,
                timeline: demoData.timeline,
                isDemo: true
            });
        }
        const days = parseInt(req.query.days) || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const scans = await Scan_1.default.find({
            userId: req.userId,
            scanTimestamp: { $gte: cutoffDate },
            status: 'completed',
        })
            .sort({ scanTimestamp: 1 })
            .lean();
        const timeline = scans.map(scan => ({
            date: scan.scanTimestamp.toISOString().split('T')[0],
            score: scan.endpointExposureScore || 100,
        }));
        // Group by date and average
        const grouped = {};
        timeline.forEach(item => {
            if (!grouped[item.date]) {
                grouped[item.date] = [];
            }
            grouped[item.date].push(item.score);
        });
        const result = Object.entries(grouped).map(([date, scores]) => ({
            date,
            score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        }));
        res.json({
            success: true,
            timeline: result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching timeline',
        });
    }
});
// Get top endpoints
router.get('/top-endpoints', auth_1.optionalAuth, async (req, res) => {
    try {
        // If no user is authenticated, return demo data
        if (!req.userId) {
            const demoData = getDemoData();
            console.log('Returning demo endpoints for unauthenticated user');
            return res.json({
                success: true,
                endpoints: demoData.endpoints,
                isDemo: true
            });
        }
        const limit = parseInt(req.query.limit) || 5;
        const scans = await Scan_1.default.find({
            userId: req.userId,
            status: 'completed',
        })
            .sort({ scanTimestamp: -1 })
            .limit(10)
            .lean();
        if (scans.length === 0) {
            return res.json({
                success: true,
                endpoints: [],
            });
        }
        const endpointMap = {};
        scans.forEach(scan => {
            if (scan.vulnerabilities?.items) {
                scan.vulnerabilities.items.forEach(vuln => {
                    if (vuln.affectedEndpoints) {
                        vuln.affectedEndpoints.forEach(endpoint => {
                            if (!endpointMap[endpoint]) {
                                endpointMap[endpoint] = {
                                    endpoint,
                                    cvssScores: [],
                                    vulnerabilities: new Set(),
                                    maxCVSS: 0,
                                };
                            }
                            endpointMap[endpoint].cvssScores.push(vuln.cvssScore || 0);
                            endpointMap[endpoint].vulnerabilities.add(vuln.cveId || 'Unknown');
                            endpointMap[endpoint].maxCVSS = Math.max(endpointMap[endpoint].maxCVSS, vuln.cvssScore || 0);
                        });
                    }
                });
            }
        });
        const endpoints = Object.values(endpointMap)
            .map(ep => ({
            endpoint: ep.endpoint,
            exposureScore: Math.round((10 - (ep.cvssScores.reduce((a, b) => a + b, 0) / ep.cvssScores.length || 0)) * 10),
            vulnerabilities: Array.from(ep.vulnerabilities),
            riskLevel: ep.maxCVSS >= 9 ? 'critical' :
                ep.maxCVSS >= 7 ? 'high' :
                    ep.maxCVSS >= 4 ? 'medium' : 'low',
            recommendation: `Update affected software to patch ${ep.vulnerabilities.size} vulnerability${ep.vulnerabilities.size !== 1 ? 'ies' : ''}`,
        }))
            .sort((a, b) => b.exposureScore - a.exposureScore)
            .slice(0, limit);
        res.json({
            success: true,
            endpoints,
        });
    }
    catch (error) {
        console.error('Error fetching top endpoints:', error);
        res.json({
            success: true,
            endpoints: [],
        });
    }
});
// Get top vulnerable software
router.get('/top-vulnerable-software', auth_1.optionalAuth, async (req, res) => {
    try {
        // If no user is authenticated, return demo data
        if (!req.userId) {
            const demoData = getDemoData();
            console.log('Returning demo software for unauthenticated user');
            return res.json({
                success: true,
                software: demoData.software,
                isDemo: true
            });
        }
        const limit = parseInt(req.query.limit) || 5;
        const scans = await Scan_1.default.find({
            userId: req.userId,
            status: 'completed',
        })
            .sort({ scanTimestamp: -1 })
            .lean();
        if (scans.length === 0) {
            return res.json({
                success: true,
                software: [],
            });
        }
        const softwareMap = {};
        scans.forEach(scan => {
            if (scan.vulnerabilities?.items) {
                scan.vulnerabilities.items.forEach(vuln => {
                    const key = `${vuln.software || 'Unknown'}-${vuln.version || 'Unknown'}`;
                    if (!softwareMap[key]) {
                        softwareMap[key] = {
                            name: vuln.software || 'Unknown Software',
                            version: vuln.version || 'Unknown',
                            devices: new Set(),
                            cves: new Set(),
                            maxCVSS: 0,
                            latestCVE: vuln.cveId || 'Unknown',
                        };
                    }
                    softwareMap[key].devices.add(scan.deviceId);
                    softwareMap[key].cves.add(vuln.cveId || 'Unknown');
                    softwareMap[key].maxCVSS = Math.max(softwareMap[key].maxCVSS, vuln.cvssScore || 0);
                    if ((vuln.cveId || '') > softwareMap[key].latestCVE) {
                        softwareMap[key].latestCVE = vuln.cveId || 'Unknown';
                    }
                });
            }
        });
        const software = Object.values(softwareMap)
            .map(s => ({
            name: s.name,
            version: s.version,
            devicesAffected: s.devices.size,
            cveCount: s.cves.size,
            highestCVSS: s.maxCVSS,
            latestCVE: s.latestCVE,
            recommendation: `Update ${s.name} to the latest version`,
        }))
            .sort((a, b) => {
            if (b.highestCVSS !== a.highestCVSS)
                return b.highestCVSS - a.highestCVSS;
            return b.cveCount - a.cveCount;
        })
            .slice(0, limit);
        res.json({
            success: true,
            software,
        });
    }
    catch (error) {
        console.error('Error fetching vulnerable software:', error);
        res.json({
            success: true,
            software: [],
        });
    }
});
// Get vulnerability insights
router.get('/vulnerability-insights', auth_1.optionalAuth, async (req, res) => {
    try {
        // If no user is authenticated, return demo data
        if (!req.userId) {
            const demoData = getDemoData();
            console.log('Returning demo insights for unauthenticated user');
            return res.json({
                success: true,
                insights: demoData.insights,
                isDemo: true
            });
        }
        const scans = await Scan_1.default.find({
            userId: req.userId,
            status: 'completed',
        })
            .sort({ scanTimestamp: -1 })
            .lean();
        if (scans.length === 0) {
            return res.json({
                success: true,
                insights: {
                    total: 0,
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0,
                    exploitable: 0,
                    byCategory: {},
                    trend: {
                        lastWeek: 0,
                        change: 0,
                        percentage: 0,
                    },
                },
            });
        }
        const allVulns = scans.flatMap(s => s.vulnerabilities?.items || []);
        const total = allVulns.length;
        const critical = allVulns.filter(v => v.severity === 'critical').length;
        const high = allVulns.filter(v => v.severity === 'high').length;
        const medium = allVulns.filter(v => v.severity === 'medium').length;
        const low = allVulns.filter(v => v.severity === 'low').length;
        const exploitable = allVulns.filter(v => v.exploitable).length;
        // Mock categories based on description
        const byCategory = {
            'Remote Code Execution': allVulns.filter(v => (v.description || '').toLowerCase().includes('code execution')).length,
            'Privilege Escalation': allVulns.filter(v => (v.description || '').toLowerCase().includes('privilege')).length,
            'Information Disclosure': allVulns.filter(v => (v.description || '').toLowerCase().includes('information') || (v.description || '').toLowerCase().includes('disclosure')).length,
            'Denial of Service': allVulns.filter(v => (v.description || '').toLowerCase().includes('denial') || (v.description || '').toLowerCase().includes('dos')).length,
            'Cross-Site Scripting': allVulns.filter(v => (v.description || '').toLowerCase().includes('xss') || (v.description || '').toLowerCase().includes('scripting')).length,
        };
        // Calculate trend (last 7 days vs previous 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const lastWeek = scans.filter(s => new Date(s.scanTimestamp) >= sevenDaysAgo)
            .reduce((sum, s) => sum + (s.vulnerabilities?.total || 0), 0);
        const previousWeek = scans.filter(s => new Date(s.scanTimestamp) >= fourteenDaysAgo && new Date(s.scanTimestamp) < sevenDaysAgo).reduce((sum, s) => sum + (s.vulnerabilities?.total || 0), 0);
        const change = lastWeek - previousWeek;
        const percentage = previousWeek > 0 ? Math.round((change / previousWeek) * 100 * 10) / 10 : 0;
        res.json({
            success: true,
            insights: {
                total,
                critical,
                high,
                medium,
                low,
                exploitable,
                byCategory,
                trend: {
                    lastWeek,
                    change,
                    percentage,
                },
            },
        });
    }
    catch (error) {
        console.error('Error fetching insights:', error);
        res.json({
            success: true,
            insights: {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                exploitable: 0,
                byCategory: {},
                trend: {
                    lastWeek: 0,
                    change: 0,
                    percentage: 0,
                },
            },
        });
    }
});
// Get top remediation activities
router.get('/top-remediation-activities', auth_1.optionalAuth, async (req, res) => {
    try {
        // If no user is authenticated, return demo data
        if (!req.userId) {
            const demoData = getDemoData();
            console.log('Returning demo activities for unauthenticated user');
            return res.json({
                success: true,
                activities: demoData.activities,
                isDemo: true
            });
        }
        const limit = parseInt(req.query.limit) || 5;
        const scans = await Scan_1.default.find({
            userId: req.userId,
            status: 'completed',
        })
            .sort({ scanTimestamp: -1 })
            .limit(20)
            .lean();
        const activities = await (0, remediation_1.getTopRemediationActivities)(scans, limit);
        res.json({
            success: true,
            activities,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching remediation activities',
        });
    }
});
// Get daily checklist
router.get('/daily-checklist', auth_1.optionalAuth, async (req, res) => {
    try {
        // If no user is authenticated, return demo data
        if (!req.userId) {
            const demoData = getDemoData();
            console.log('Returning demo checklist for unauthenticated user');
            return res.json({
                success: true,
                ...demoData.checklist,
                isDemo: true
            });
        }
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const today = new Date().toISOString().split('T')[0];
        const checklistDate = user.dailyChecklist?.date
            ? new Date(user.dailyChecklist.date).toISOString().split('T')[0]
            : null;
        let checklist = user.dailyChecklist;
        // Generate new checklist if needed
        if (!checklist || checklistDate !== today) {
            checklist = {
                date: new Date(),
                items: [
                    { id: 1, task: 'OS Updated', completed: false },
                    { id: 2, task: 'No High-Risk Software', completed: false },
                    { id: 3, task: 'Antivirus Enabled', completed: false },
                    { id: 4, task: 'No Critical CVEs', completed: false },
                    { id: 5, task: 'Firewall Active', completed: false },
                ],
            };
            user.dailyChecklist = checklist;
            await user.save();
        }
        const completedCount = checklist.items.filter(i => i.completed).length;
        const completionPercentage = Math.round((completedCount / checklist.items.length) * 100);
        // Calculate streak (simplified - check last 7 days)
        const streakDays = 7; // Mock value
        res.json({
            success: true,
            date: today,
            checklist: checklist.items,
            completionPercentage,
            streakDays,
            contributionToScore: completedCount * 1, // 1 point per item
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching checklist',
        });
    }
});
// Update checklist item
router.put('/daily-checklist/:itemId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { completed } = req.body;
        const itemId = parseInt(req.params.itemId);
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const today = new Date().toISOString().split('T')[0];
        const checklistDate = user.dailyChecklist?.date
            ? new Date(user.dailyChecklist.date).toISOString().split('T')[0]
            : null;
        if (!user.dailyChecklist || checklistDate !== today) {
            user.dailyChecklist = {
                date: new Date(),
                items: [
                    { id: 1, task: 'OS Updated', completed: false },
                    { id: 2, task: 'No High-Risk Software', completed: false },
                    { id: 3, task: 'Antivirus Enabled', completed: false },
                    { id: 4, task: 'No Critical CVEs', completed: false },
                    { id: 5, task: 'Firewall Active', completed: false },
                ],
            };
        }
        const item = user.dailyChecklist.items.find(i => i.id === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Checklist item not found' });
        }
        const wasCompleted = item.completed;
        item.completed = completed;
        if (completed) {
            item.completedAt = new Date();
        }
        else {
            item.completedAt = undefined;
        }
        await user.save();
        const completedCount = user.dailyChecklist.items.filter(i => i.completed).length;
        const newCompletionPercentage = Math.round((completedCount / user.dailyChecklist.items.length) * 100);
        // Calculate score impact based on checklist completion
        let scoreImpact = 0;
        if (completed && !wasCompleted) {
            scoreImpact = +2; // Positive impact for completing item
        }
        else if (!completed && wasCompleted) {
            scoreImpact = -2; // Negative impact for uncompleting item
        }
        // If all items are completed, give bonus
        if (completedCount === user.dailyChecklist.items.length && completed && !wasCompleted) {
            scoreImpact += 3; // Bonus for completing all items
        }
        res.json({
            success: true,
            item,
            newCompletionPercentage,
            scoreImpact,
            allCompleted: completedCount === user.dailyChecklist.items.length,
        });
    }
    catch (error) {
        console.error('Error updating checklist:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating checklist',
        });
    }
});
// Log remediation activity
router.post('/log-remediation', auth_1.authenticateToken, async (req, res) => {
    try {
        const { action, target, deviceId, timestamp } = req.body;
        // In a real implementation, you'd store this in a RemediationLog model
        // For now, we'll just log it and return success
        console.log(`Remediation activity logged:`, {
            userId: req.userId,
            action,
            target,
            deviceId,
            timestamp: timestamp || new Date().toISOString(),
        });
        res.json({
            success: true,
            message: 'Remediation activity logged successfully',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error logging remediation activity',
        });
    }
});
exports.default = router;
