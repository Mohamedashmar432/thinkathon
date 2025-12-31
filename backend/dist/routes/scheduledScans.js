"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const scheduledScanService_1 = __importDefault(require("../services/scheduledScanService"));
const ScheduledScan_1 = __importDefault(require("../models/ScheduledScan"));
const Agent_1 = __importDefault(require("../models/Agent"));
const router = express_1.default.Router();
// Get all scheduled scans for user
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { deviceId } = req.query;
        const scheduledScans = await scheduledScanService_1.default.getScheduledScans(req.userId, deviceId);
        // Group by device and scan type for easier frontend consumption
        const groupedScans = {};
        for (const scan of scheduledScans) {
            if (!groupedScans[scan.deviceId]) {
                groupedScans[scan.deviceId] = {
                    deviceId: scan.deviceId,
                    quick: null,
                    health: null
                };
            }
            groupedScans[scan.deviceId][scan.scanType] = {
                id: scan._id,
                enabled: scan.enabled,
                scheduledTimeIST: scan.scheduledTimeIST,
                scheduledTimeUTC: scan.scheduledTimeUTC,
                lastRun: scan.lastRun,
                nextRun: scan.nextRun,
                totalRuns: scan.totalRuns,
                missedRuns: scan.missedRuns,
                createdAt: scan.createdAt,
                updatedAt: scan.updatedAt
            };
        }
        res.json({
            success: true,
            scheduledScans: Object.values(groupedScans),
            total: scheduledScans.length
        });
    }
    catch (error) {
        console.error('Error fetching scheduled scans:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching scheduled scans'
        });
    }
});
// Create or update scheduled scan
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { deviceId, scanType, enabled, scheduledTimeIST = '05:00' } = req.body;
        // Validate required fields
        if (!deviceId || !scanType) {
            return res.status(400).json({
                success: false,
                message: 'Device ID and scan type are required'
            });
        }
        if (!['quick', 'health'].includes(scanType)) {
            return res.status(400).json({
                success: false,
                message: 'Scan type must be "quick" or "health"'
            });
        }
        // Validate scheduled time format (HH:MM)
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(scheduledTimeIST)) {
            return res.status(400).json({
                success: false,
                message: 'Scheduled time must be in HH:MM format (24-hour)'
            });
        }
        // Check if device exists and belongs to user
        const agent = await Agent_1.default.findOne({
            userId: req.userId,
            deviceId: deviceId
        });
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: 'Device not found or does not belong to user'
            });
        }
        // Create or update scheduled scan
        const scheduledScan = await scheduledScanService_1.default.createOrUpdateScheduledScan(req.userId, req.user.email, deviceId, scanType, enabled, scheduledTimeIST);
        res.json({
            success: true,
            scheduledScan: {
                id: scheduledScan._id,
                deviceId: scheduledScan.deviceId,
                scanType: scheduledScan.scanType,
                enabled: scheduledScan.enabled,
                scheduledTimeIST: scheduledScan.scheduledTimeIST,
                scheduledTimeUTC: scheduledScan.scheduledTimeUTC,
                nextRun: scheduledScan.nextRun,
                lastRun: scheduledScan.lastRun,
                totalRuns: scheduledScan.totalRuns,
                missedRuns: scheduledScan.missedRuns
            },
            message: `Scheduled ${scanType} scan ${enabled ? 'enabled' : 'disabled'} for device ${deviceId}`
        });
    }
    catch (error) {
        console.error('Error creating/updating scheduled scan:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating/updating scheduled scan'
        });
    }
});
// Update scheduled scan status (enable/disable)
router.put('/:scanId/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const { scanId } = req.params;
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Enabled status must be a boolean'
            });
        }
        const scheduledScan = await ScheduledScan_1.default.findOne({
            _id: scanId,
            userId: req.userId
        });
        if (!scheduledScan) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled scan not found'
            });
        }
        scheduledScan.enabled = enabled;
        if (enabled) {
            // Recalculate next run time when enabling
            scheduledScan.calculateNextRun();
        }
        await scheduledScan.save();
        res.json({
            success: true,
            scheduledScan: {
                id: scheduledScan._id,
                enabled: scheduledScan.enabled,
                nextRun: scheduledScan.nextRun
            },
            message: `Scheduled scan ${enabled ? 'enabled' : 'disabled'}`
        });
    }
    catch (error) {
        console.error('Error updating scheduled scan status:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating scheduled scan status'
        });
    }
});
// Delete scheduled scan
router.delete('/:scanId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { scanId } = req.params;
        const scheduledScan = await ScheduledScan_1.default.findOneAndDelete({
            _id: scanId,
            userId: req.userId
        });
        if (!scheduledScan) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled scan not found'
            });
        }
        res.json({
            success: true,
            message: `Scheduled ${scheduledScan.scanType} scan deleted for device ${scheduledScan.deviceId}`
        });
    }
    catch (error) {
        console.error('Error deleting scheduled scan:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error deleting scheduled scan'
        });
    }
});
// Run scheduled scan immediately (manual trigger)
router.post('/:scanId/run-now', auth_1.authenticateToken, async (req, res) => {
    try {
        const { scanId } = req.params;
        const scheduledScan = await ScheduledScan_1.default.findOne({
            _id: scanId,
            userId: req.userId
        });
        if (!scheduledScan) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled scan not found'
            });
        }
        // Execute the scan immediately
        await scheduledScanService_1.default.executeScheduledScan(scheduledScan);
        res.json({
            success: true,
            message: `${scheduledScan.scanType} scan executed successfully for device ${scheduledScan.deviceId}`
        });
    }
    catch (error) {
        console.error('Error running scheduled scan:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error running scheduled scan'
        });
    }
});
// Get scheduler service status
router.get('/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const status = scheduledScanService_1.default.getStatus();
        // Get summary statistics
        const totalScheduled = await ScheduledScan_1.default.countDocuments({ userId: req.userId });
        const enabledScheduled = await ScheduledScan_1.default.countDocuments({
            userId: req.userId,
            enabled: true
        });
        // Get next upcoming scan
        const nextScan = await ScheduledScan_1.default.findOne({
            userId: req.userId,
            enabled: true
        }).sort({ nextRun: 1 });
        res.json({
            success: true,
            status: {
                ...status,
                totalScheduled,
                enabledScheduled,
                nextUpcomingScan: nextScan ? {
                    deviceId: nextScan.deviceId,
                    scanType: nextScan.scanType,
                    nextRun: nextScan.nextRun,
                    scheduledTimeIST: nextScan.scheduledTimeIST
                } : null
            }
        });
    }
    catch (error) {
        console.error('Error getting scheduler status:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error getting scheduler status'
        });
    }
});
// Get scheduled scan history/statistics
router.get('/history', auth_1.authenticateToken, async (req, res) => {
    try {
        const { deviceId } = req.query;
        const query = { userId: req.userId };
        if (deviceId) {
            query.deviceId = deviceId;
        }
        const scheduledScans = await ScheduledScan_1.default.find(query);
        // Calculate statistics
        const stats = {
            totalScheduled: scheduledScans.length,
            enabled: scheduledScans.filter(s => s.enabled).length,
            totalRuns: scheduledScans.reduce((sum, s) => sum + s.totalRuns, 0),
            totalMissed: scheduledScans.reduce((sum, s) => sum + s.missedRuns, 0),
            successRate: 0
        };
        if (stats.totalRuns + stats.totalMissed > 0) {
            stats.successRate = Math.round((stats.totalRuns / (stats.totalRuns + stats.totalMissed)) * 100);
        }
        // Get recent execution history
        const recentHistory = scheduledScans
            .filter(s => s.lastRun)
            .map(s => ({
            deviceId: s.deviceId,
            scanType: s.scanType,
            lastRun: s.lastRun,
            nextRun: s.nextRun,
            totalRuns: s.totalRuns,
            missedRuns: s.missedRuns
        }))
            .sort((a, b) => new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime())
            .slice(0, 10);
        res.json({
            success: true,
            stats,
            recentHistory,
            scheduledScans: scheduledScans.map(s => ({
                id: s._id,
                deviceId: s.deviceId,
                scanType: s.scanType,
                enabled: s.enabled,
                scheduledTimeIST: s.scheduledTimeIST,
                nextRun: s.nextRun,
                lastRun: s.lastRun,
                totalRuns: s.totalRuns,
                missedRuns: s.missedRuns
            }))
        });
    }
    catch (error) {
        console.error('Error fetching scheduled scan history:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching scheduled scan history'
        });
    }
});
exports.default = router;
