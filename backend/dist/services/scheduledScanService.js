"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cron = __importStar(require("node-cron"));
const ScheduledScan_1 = __importDefault(require("../models/ScheduledScan"));
const Agent_1 = __importDefault(require("../models/Agent"));
const Scan_1 = __importDefault(require("../models/Scan"));
const User_1 = __importDefault(require("../models/User"));
const vulnerabilityAnalyzer_1 = require("../utils/vulnerabilityAnalyzer");
const scoreCalculator_1 = require("../utils/scoreCalculator");
class ScheduledScanService {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.startScheduler();
    }
    // Start the main scheduler that runs every minute
    startScheduler() {
        if (this.cronJob) {
            this.cronJob.destroy();
        }
        // Run every minute to check for scheduled scans
        this.cronJob = cron.schedule('* * * * *', async () => {
            if (!this.isRunning) {
                this.isRunning = true;
                try {
                    await this.checkAndExecuteScheduledScans();
                }
                catch (error) {
                    console.error('Error in scheduled scan execution:', error);
                }
                finally {
                    this.isRunning = false;
                }
            }
        }, {
            timezone: 'UTC'
        });
        console.log('📅 Scheduled scan service started');
    }
    // Stop the scheduler
    stopScheduler() {
        if (this.cronJob) {
            this.cronJob.destroy();
            this.cronJob = null;
            console.log('📅 Scheduled scan service stopped');
        }
    }
    // Check for and execute due scheduled scans
    async checkAndExecuteScheduledScans() {
        try {
            const now = new Date();
            // Find all enabled scheduled scans that are due
            const dueScans = await ScheduledScan_1.default.find({
                enabled: true,
                nextRun: { $lte: now }
            }).populate('userId');
            console.log(`🔍 Found ${dueScans.length} due scheduled scans`);
            for (const scheduledScan of dueScans) {
                try {
                    await this.executeScheduledScan(scheduledScan);
                }
                catch (error) {
                    console.error(`Error executing scheduled scan ${scheduledScan._id}:`, error);
                    // Increment missed runs counter
                    scheduledScan.missedRuns += 1;
                    scheduledScan.calculateNextRun();
                    await scheduledScan.save();
                }
            }
        }
        catch (error) {
            console.error('Error checking scheduled scans:', error);
        }
    }
    // Execute a specific scheduled scan
    async executeScheduledScan(scheduledScan) {
        console.log(`🚀 Executing scheduled ${scheduledScan.scanType} scan for device ${scheduledScan.deviceId}`);
        try {
            // Check if agent is active
            const agent = await Agent_1.default.findOne({
                userId: scheduledScan.userId,
                deviceId: scheduledScan.deviceId,
                status: 'active'
            });
            if (!agent) {
                console.log(`⚠️ Agent ${scheduledScan.deviceId} is not active, skipping scan`);
                scheduledScan.missedRuns += 1;
                scheduledScan.calculateNextRun();
                await scheduledScan.save();
                return;
            }
            // Create scan record
            const scan = new Scan_1.default({
                userId: scheduledScan.userId,
                userEmail: scheduledScan.userEmail,
                deviceId: scheduledScan.deviceId,
                scanTimestamp: new Date(),
                scanType: scheduledScan.scanType,
                isScheduled: true,
                scheduledScanId: scheduledScan._id,
                status: 'running',
                systemInfo: agent.systemInfo || {
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
            // Simulate scan execution (in real implementation, this would trigger agent scan)
            await this.simulateScheduledScanExecution(scan, scheduledScan);
            // Update scheduled scan record
            scheduledScan.lastRun = new Date();
            scheduledScan.totalRuns += 1;
            scheduledScan.calculateNextRun();
            await scheduledScan.save();
            console.log(`✅ Scheduled ${scheduledScan.scanType} scan completed for device ${scheduledScan.deviceId}`);
        }
        catch (error) {
            console.error(`❌ Error executing scheduled scan:`, error);
            throw error;
        }
    }
    // Simulate scan execution (replace with actual agent communication)
    async simulateScheduledScanExecution(scan, scheduledScan) {
        // Simulate scan processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            // Generate mock scan data based on scan type
            const mockScanData = this.generateMockScanData(scheduledScan.scanType);
            // Update scan with results
            scan.software = mockScanData.software;
            scan.browserExtensions = mockScanData.browserExtensions;
            scan.patches = mockScanData.patches;
            scan.status = 'analyzing';
            await scan.save();
            // Analyze vulnerabilities
            const vulnerabilities = (0, vulnerabilityAnalyzer_1.analyzeVulnerabilities)(scan);
            const endpointExposureScore = (0, scoreCalculator_1.calculateEndpointExposureScore)({
                ...scan.toObject(),
                vulnerabilities,
            });
            const user = await User_1.default.findById(scheduledScan.userId);
            const userScans = await Scan_1.default.find({ userId: scheduledScan.userId });
            const secureScore = (0, scoreCalculator_1.calculateUserSecureScore)([...userScans, scan], user);
            // Ensure scores are valid numbers
            const validSecureScore = isNaN(secureScore) ? 0 : Math.max(0, Math.min(100, secureScore));
            const validEndpointScore = isNaN(endpointExposureScore) ? 100 : Math.max(0, Math.min(100, endpointExposureScore));
            // Update scan with analysis results
            scan.vulnerabilities = vulnerabilities;
            scan.secureScore = validSecureScore;
            scan.endpointExposureScore = validEndpointScore;
            scan.status = 'completed';
            scan.analyzedAt = new Date();
            await scan.save();
            // Update agent last scan time
            await Agent_1.default.findOneAndUpdate({ userId: scheduledScan.userId, deviceId: scheduledScan.deviceId }, { lastScan: new Date() });
        }
        catch (error) {
            scan.status = 'failed';
            scan.errorMessage = error.message;
            await scan.save();
            throw error;
        }
    }
    // Generate mock scan data for testing
    generateMockScanData(scanType) {
        const baseSoftware = [
            { name: 'Google Chrome', version: '120.0.6099.109', publisher: 'Google LLC' },
            { name: 'Microsoft Office', version: '16.0.17126.20132', publisher: 'Microsoft Corporation' },
            { name: 'Adobe Reader', version: '2023.008.20458', publisher: 'Adobe Inc.' },
            { name: 'Java Runtime Environment', version: '8.0.391', publisher: 'Oracle Corporation' },
            { name: 'Windows Defender', version: '4.18.24010.12', publisher: 'Microsoft Corporation' }
        ];
        const healthScanSoftware = [
            ...baseSoftware,
            { name: 'Visual Studio Code', version: '1.85.1', publisher: 'Microsoft Corporation' },
            { name: 'Node.js', version: '20.10.0', publisher: 'Node.js Foundation' },
            { name: 'Git', version: '2.43.0', publisher: 'The Git Development Community' }
        ];
        return {
            software: scanType === 'health' ? healthScanSoftware : baseSoftware,
            browserExtensions: [
                { name: 'uBlock Origin', version: '1.54.0', browser: 'Chrome' },
                { name: 'LastPass', version: '4.125.0', browser: 'Chrome' }
            ],
            patches: {
                totalPatches: Math.floor(Math.random() * 50) + 10,
                latestPatchId: `KB${Math.floor(Math.random() * 9000000) + 1000000}`,
                latestPatchDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
            }
        };
    }
    // Create or update scheduled scan for a user/device
    async createOrUpdateScheduledScan(userId, userEmail, deviceId, scanType, enabled, scheduledTimeIST = '05:00') {
        try {
            const scheduledTimeUTC = this.convertISTToUTC(scheduledTimeIST);
            const scheduledScan = await ScheduledScan_1.default.findOneAndUpdate({ userId, deviceId, scanType }, {
                userEmail,
                enabled,
                scheduledTimeIST,
                scheduledTimeUTC,
                timezone: 'Asia/Kolkata',
                updatedAt: new Date()
            }, {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            });
            // Calculate next run time
            scheduledScan.calculateNextRun();
            await scheduledScan.save();
            console.log(`📅 ${enabled ? 'Enabled' : 'Disabled'} scheduled ${scanType} scan for device ${deviceId}`);
            return scheduledScan;
        }
        catch (error) {
            console.error('Error creating/updating scheduled scan:', error);
            throw error;
        }
    }
    // Get scheduled scans for a user
    async getScheduledScans(userId, deviceId) {
        try {
            const query = { userId };
            if (deviceId) {
                query.deviceId = deviceId;
            }
            const scheduledScans = await ScheduledScan_1.default.find(query).sort({ scanType: 1, deviceId: 1 });
            return scheduledScans;
        }
        catch (error) {
            console.error('Error fetching scheduled scans:', error);
            throw error;
        }
    }
    // Delete scheduled scan
    async deleteScheduledScan(userId, deviceId, scanType) {
        try {
            await ScheduledScan_1.default.findOneAndDelete({ userId, deviceId, scanType });
            console.log(`🗑️ Deleted scheduled ${scanType} scan for device ${deviceId}`);
        }
        catch (error) {
            console.error('Error deleting scheduled scan:', error);
            throw error;
        }
    }
    // Get scheduler status
    getStatus() {
        return {
            isRunning: this.cronJob !== null,
            isExecuting: this.isRunning,
            nextCheck: this.cronJob ? 'Every minute' : 'Not scheduled'
        };
    }
    // Helper method to convert IST to UTC
    convertISTToUTC(istTime) {
        const [hours, minutes] = istTime.split(':').map(Number);
        // IST is UTC+5:30, so subtract 5 hours and 30 minutes
        let utcHours = hours - 5;
        let utcMinutes = minutes - 30;
        // Handle minute underflow
        if (utcMinutes < 0) {
            utcMinutes += 60;
            utcHours -= 1;
        }
        // Handle hour underflow (previous day)
        if (utcHours < 0) {
            utcHours += 24;
        }
        return `${utcHours.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}`;
    }
}
// Export singleton instance
exports.default = new ScheduledScanService();
