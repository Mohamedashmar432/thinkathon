"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const systemLogger_1 = __importDefault(require("../services/systemLogger"));
const troubleshootService_1 = __importDefault(require("../services/troubleshootService"));
const User_1 = __importDefault(require("../models/User"));
const Agent_1 = __importDefault(require("../models/Agent"));
const Scan_1 = __importDefault(require("../models/Scan"));
const ThreatIntelItem_1 = __importDefault(require("../models/ThreatIntelItem"));
const ThreatCorrelation_1 = __importDefault(require("../models/ThreatCorrelation"));
const ScheduledScan_1 = __importDefault(require("../models/ScheduledScan"));
const Recommendation_1 = __importDefault(require("../models/Recommendation"));
const router = express_1.default.Router();
// Admin authentication middleware
const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Server configuration error'
            });
        }
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User_1.default.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        // Check if user is admin
        const adminEmails = [
            'admin@thinkbridge.in',
            'admin@thinkbridge.com',
            'ashmar@thinkbridge.in', // Demo admin
            'support@thinkbridge.in'
        ];
        const isAdmin = adminEmails.includes(user.email) ||
            user.email.includes('admin') ||
            user.role === 'admin';
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        req.user = user;
        req.userId = user._id.toString();
        next();
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
};
// Get system overview
router.get('/overview', adminAuth, async (req, res) => {
    try {
        await systemLogger_1.default.info('api', 'admin_overview_access', `Admin ${req.user.email} accessed system overview`);
        const [totalUsers, totalAgents, totalScans, totalThreats, totalCorrelations, totalScheduledScans, totalRecommendations, recentErrors] = await Promise.all([
            User_1.default.countDocuments(),
            Agent_1.default.countDocuments(),
            Scan_1.default.countDocuments(),
            ThreatIntelItem_1.default.countDocuments(),
            ThreatCorrelation_1.default.countDocuments(),
            ScheduledScan_1.default.countDocuments(),
            Recommendation_1.default.countDocuments(),
            systemLogger_1.default.getLogs({
                level: ['error'],
                limit: 10,
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
            })
        ]);
        const overview = {
            users: {
                total: totalUsers,
                active: await User_1.default.countDocuments({
                    lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }),
                organization: await User_1.default.countDocuments({
                    email: { $regex: /@thinkbridge\.(com|in)$/ }
                })
            },
            agents: {
                total: totalAgents,
                active: await Agent_1.default.countDocuments({ status: 'active' }),
                windows: await Agent_1.default.countDocuments({ 'systemInfo.osName': /windows/i }),
                linux: await Agent_1.default.countDocuments({ 'systemInfo.osName': /linux/i }),
                macos: await Agent_1.default.countDocuments({ 'systemInfo.osName': /darwin|mac/i })
            },
            scans: {
                total: totalScans,
                completed: await Scan_1.default.countDocuments({ status: 'completed' }),
                failed: await Scan_1.default.countDocuments({ status: 'failed' }),
                recent: await Scan_1.default.countDocuments({
                    scanTimestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })
            },
            threats: {
                total: totalThreats,
                exploited: await ThreatIntelItem_1.default.countDocuments({ exploited: true }),
                correlations: totalCorrelations,
                recent: await ThreatIntelItem_1.default.countDocuments({
                    publishedDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                })
            },
            scheduled: {
                total: totalScheduledScans,
                enabled: await ScheduledScan_1.default.countDocuments({ enabled: true }),
                recent: await ScheduledScan_1.default.countDocuments({
                    lastRun: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })
            },
            recommendations: {
                total: totalRecommendations,
                active: await Recommendation_1.default.countDocuments({ status: { $in: ['not_started', 'in_progress'] } }),
                completed: await Recommendation_1.default.countDocuments({ status: 'completed' })
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                recentErrors: recentErrors.logs.length
            }
        };
        res.json({
            success: true,
            overview
        });
    }
    catch (error) {
        await systemLogger_1.default.error('api', 'admin_overview_error', `Admin overview failed: ${error}`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch system overview'
        });
    }
});
// Get all users (admin view)
router.get('/users', adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            User_1.default.find({}, '-password')
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .lean(),
            User_1.default.countDocuments()
        ]);
        // Enrich with agent and scan counts
        const enrichedUsers = await Promise.all(users.map(async (user) => {
            const [agentCount, scanCount, lastScan] = await Promise.all([
                Agent_1.default.countDocuments({ userId: user._id }),
                Scan_1.default.countDocuments({ userId: user._id }),
                Scan_1.default.findOne({ userId: user._id }).sort({ scanTimestamp: -1 }).lean()
            ]);
            return {
                ...user,
                agentCount,
                scanCount,
                lastScanDate: lastScan?.scanTimestamp
            };
        }));
        await systemLogger_1.default.info('api', 'admin_users_access', `Admin ${req.user.email} accessed user list (page ${page})`);
        res.json({
            success: true,
            users: enrichedUsers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        await systemLogger_1.default.error('api', 'admin_users_error', `Admin users list failed: ${error}`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});
// Get all agents (admin view)
router.get('/agents', adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;
        const [agents, total] = await Promise.all([
            Agent_1.default.find()
                .populate('userId', 'email firstName lastName')
                .sort({ lastSeen: -1 })
                .limit(limit)
                .skip(skip)
                .lean(),
            Agent_1.default.countDocuments()
        ]);
        await systemLogger_1.default.info('api', 'admin_agents_access', `Admin ${req.user.email} accessed agent list (page ${page})`);
        res.json({
            success: true,
            agents,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        await systemLogger_1.default.error('api', 'admin_agents_error', `Admin agents list failed: ${error}`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch agents'
        });
    }
});
// Run system troubleshoot
router.post('/troubleshoot', adminAuth, async (req, res) => {
    try {
        await systemLogger_1.default.info('api', 'admin_troubleshoot_start', `Admin ${req.user.email} initiated system troubleshoot`);
        const report = await troubleshootService_1.default.runFullDiagnostic();
        await systemLogger_1.default.info('api', 'admin_troubleshoot_complete', `System troubleshoot completed by ${req.user.email}`, {
            executionId: report.executionId,
            overallStatus: report.overallStatus,
            healthScore: report.healthScore,
            duration: report.duration
        });
        res.json({
            success: true,
            report
        });
    }
    catch (error) {
        await systemLogger_1.default.error('api', 'admin_troubleshoot_error', `System troubleshoot failed: ${error}`, error);
        res.status(500).json({
            success: false,
            message: 'Troubleshoot execution failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Get system logs
router.get('/logs', adminAuth, async (req, res) => {
    try {
        const filters = {
            level: req.query.level ? req.query.level.split(',') : undefined,
            component: req.query.component ? req.query.component.split(',') : undefined,
            success: req.query.success ? req.query.success === 'true' : undefined,
            userId: req.query.userId,
            deviceId: req.query.deviceId,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
            search: req.query.search,
            limit: Math.min(parseInt(req.query.limit) || 100, 1000),
            skip: parseInt(req.query.skip) || 0
        };
        const result = await systemLogger_1.default.getLogs(filters);
        await systemLogger_1.default.info('api', 'admin_logs_access', `Admin ${req.user.email} accessed system logs`, { filters: { ...filters, startDate: filters.startDate?.toISOString(), endDate: filters.endDate?.toISOString() } });
        res.json({
            success: true,
            logs: result.logs,
            total: result.total,
            filters
        });
    }
    catch (error) {
        await systemLogger_1.default.error('api', 'admin_logs_error', `Admin logs access failed: ${error}`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch logs'
        });
    }
});
// Get system health metrics
router.get('/health', adminAuth, async (req, res) => {
    try {
        const timeRange = parseInt(req.query.timeRange) || 24;
        const metrics = await systemLogger_1.default.getHealthMetrics(timeRange);
        await systemLogger_1.default.info('api', 'admin_health_access', `Admin ${req.user.email} accessed health metrics`);
        res.json({
            success: true,
            metrics
        });
    }
    catch (error) {
        await systemLogger_1.default.error('api', 'admin_health_error', `Admin health metrics failed: ${error}`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch health metrics'
        });
    }
});
// Get specific user details
router.get('/users/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const [user, agents, scans, recommendations] = await Promise.all([
            User_1.default.findById(userId, '-password').lean(),
            Agent_1.default.find({ userId }).lean(),
            Scan_1.default.find({ userId }).sort({ scanTimestamp: -1 }).limit(10).lean(),
            Recommendation_1.default.find({ userId }).sort({ createdAt: -1 }).limit(10).lean()
        ]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        await systemLogger_1.default.info('api', 'admin_user_detail_access', `Admin ${req.user.email} accessed user details for ${user.email}`);
        res.json({
            success: true,
            user: {
                ...user,
                agents,
                recentScans: scans,
                recentRecommendations: recommendations
            }
        });
    }
    catch (error) {
        await systemLogger_1.default.error('api', 'admin_user_detail_error', `Admin user detail failed: ${error}`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user details'
        });
    }
});
// System actions
router.post('/actions/clear-logs', adminAuth, async (req, res) => {
    try {
        const { olderThan } = req.body; // Days
        const cutoffDate = new Date(Date.now() - (olderThan || 30) * 24 * 60 * 60 * 1000);
        const result = await systemLogger_1.default.getLogs({
            endDate: cutoffDate,
            limit: 1000
        });
        // Note: In production, you'd want to implement actual log cleanup
        // For now, we'll just log the action
        await systemLogger_1.default.info('api', 'admin_clear_logs', `Admin ${req.user.email} requested log cleanup (${result.total} logs older than ${olderThan} days)`);
        res.json({
            success: true,
            message: `Log cleanup requested for ${result.total} logs`,
            logsAffected: result.total
        });
    }
    catch (error) {
        await systemLogger_1.default.error('api', 'admin_clear_logs_error', `Admin log cleanup failed: ${error}`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear logs'
        });
    }
});
exports.default = router;
