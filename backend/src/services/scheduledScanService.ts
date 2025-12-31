import * as cron from 'node-cron';
import ScheduledScan, { IScheduledScan } from '../models/ScheduledScan';
import Agent from '../models/Agent';
import Scan from '../models/Scan';
import User from '../models/User';
import { analyzeVulnerabilities } from '../utils/vulnerabilityAnalyzer';
import { calculateUserSecureScore, calculateEndpointExposureScore } from '../utils/scoreCalculator';

class ScheduledScanService {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor() {
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
        } catch (error) {
          console.error('Error in scheduled scan execution:', error);
        } finally {
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
      const dueScans = await ScheduledScan.find({
        enabled: true,
        nextRun: { $lte: now }
      }).populate('userId');

      console.log(`🔍 Found ${dueScans.length} due scheduled scans`);

      for (const scheduledScan of dueScans) {
        try {
          await this.executeScheduledScan(scheduledScan);
        } catch (error) {
          console.error(`Error executing scheduled scan ${scheduledScan._id}:`, error);
          
          // Increment missed runs counter
          scheduledScan.missedRuns += 1;
          scheduledScan.calculateNextRun();
          await scheduledScan.save();
        }
      }
    } catch (error) {
      console.error('Error checking scheduled scans:', error);
    }
  }

  // Execute a specific scheduled scan
  async executeScheduledScan(scheduledScan: IScheduledScan) {
    console.log(`🚀 Executing scheduled ${scheduledScan.scanType} scan for device ${scheduledScan.deviceId}`);

    try {
      // Check if agent is active
      const agent = await Agent.findOne({
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
      const scan = new Scan({
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

    } catch (error) {
      console.error(`❌ Error executing scheduled scan:`, error);
      throw error;
    }
  }

  // Simulate scan execution (replace with actual agent communication)
  async simulateScheduledScanExecution(scan: any, scheduledScan: IScheduledScan) {
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
      const vulnerabilities = analyzeVulnerabilities(scan);
      const endpointExposureScore = calculateEndpointExposureScore({
        ...scan.toObject(),
        vulnerabilities,
      } as any);

      const user = await User.findById(scheduledScan.userId);
      const userScans = await Scan.find({ userId: scheduledScan.userId });
      const secureScore = calculateUserSecureScore([...userScans, scan], user!);

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
      await Agent.findOneAndUpdate(
        { userId: scheduledScan.userId, deviceId: scheduledScan.deviceId },
        { lastScan: new Date() }
      );

    } catch (error: any) {
      scan.status = 'failed';
      scan.errorMessage = error.message;
      await scan.save();
      throw error;
    }
  }

  // Generate mock scan data for testing
  generateMockScanData(scanType: string) {
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
  async createOrUpdateScheduledScan(
    userId: string,
    userEmail: string,
    deviceId: string,
    scanType: 'quick' | 'health',
    enabled: boolean,
    scheduledTimeIST: string = '05:00'
  ) {
    try {
      const scheduledTimeUTC = this.convertISTToUTC(scheduledTimeIST);
      
      const scheduledScan = await ScheduledScan.findOneAndUpdate(
        { userId, deviceId, scanType },
        {
          userEmail,
          enabled,
          scheduledTimeIST,
          scheduledTimeUTC,
          timezone: 'Asia/Kolkata',
          updatedAt: new Date()
        },
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true 
        }
      );

      // Calculate next run time
      scheduledScan.calculateNextRun();
      await scheduledScan.save();

      console.log(`📅 ${enabled ? 'Enabled' : 'Disabled'} scheduled ${scanType} scan for device ${deviceId}`);
      return scheduledScan;

    } catch (error) {
      console.error('Error creating/updating scheduled scan:', error);
      throw error;
    }
  }

  // Get scheduled scans for a user
  async getScheduledScans(userId: string, deviceId?: string) {
    try {
      const query: any = { userId };
      if (deviceId) {
        query.deviceId = deviceId;
      }

      const scheduledScans = await ScheduledScan.find(query).sort({ scanType: 1, deviceId: 1 });
      return scheduledScans;
    } catch (error) {
      console.error('Error fetching scheduled scans:', error);
      throw error;
    }
  }

  // Delete scheduled scan
  async deleteScheduledScan(userId: string, deviceId: string, scanType: 'quick' | 'health') {
    try {
      await ScheduledScan.findOneAndDelete({ userId, deviceId, scanType });
      console.log(`🗑️ Deleted scheduled ${scanType} scan for device ${deviceId}`);
    } catch (error) {
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
  convertISTToUTC(istTime: string): string {
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
export default new ScheduledScanService();