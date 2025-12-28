import express, { Response } from 'express';
import Scan from '../models/Scan';
import User from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  calculateUserSecureScore,
  calculateEndpointExposureScore,
  getLatestScansPerDevice,
} from '../utils/scoreCalculator';
import { getTopRemediationActivities } from '../utils/remediation';

const router = express.Router();

// Get dashboard stats
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const scans = await Scan.find({ userId: req.userId }).sort({ scanTimestamp: -1 });
    const latestScans = getLatestScansPerDevice(scans);
    
    const userSecureScore = calculateUserSecureScore(scans, user);
    const endpointExposureScore = latestScans.length > 0
      ? calculateEndpointExposureScore(latestScans[0])
      : 100;

    // Calculate organization score if user is from thinkbridge.com or thinkbridge.in
    let organizationSecureScore;
    const emailDomain = user.email.split('@')[1];
    if (emailDomain === 'thinkbridge.com' || emailDomain === 'thinkbridge.in') {
      const orgUsers = await User.find({
        $or: [
          { email: { $regex: /@thinkbridge\.com$/ } },
          { email: { $regex: /@thinkbridge\.in$/ } },
        ],
      });
      const orgScores = [];
      
      for (const orgUser of orgUsers) {
        const orgScans = await Scan.find({ userId: orgUser._id })
          .sort({ scanTimestamp: -1 })
          .limit(10);
        if (orgScans.length > 0) {
          orgScores.push(calculateUserSecureScore(orgScans, orgUser));
        }
      }
      
      if (orgScores.length > 0) {
        organizationSecureScore = Math.round(
          orgScores.reduce((a, b) => a + b, 0) / orgScores.length
        );
      }
    }

    const totalVulnerabilities = scans.reduce(
      (sum, scan) => sum + (scan.vulnerabilities?.total || 0),
      0
    );
    const criticalVulnerabilities = scans.reduce(
      (sum, scan) => sum + (scan.vulnerabilities?.critical || 0),
      0
    );
    const exploitableVulnerabilities = scans.reduce(
      (sum, scan) => sum + (scan.vulnerabilities?.exploitable || 0),
      0
    );

    const uniqueDevices = new Set(scans.map(s => s.deviceId)).size;

    res.json({
      success: true,
      userSecureScore,
      organizationSecureScore,
      endpointExposureScore,
      totalScans: scans.length,
      totalDevices: uniqueDevices,
      totalVulnerabilities,
      criticalVulnerabilities,
      exploitableVulnerabilities,
      lastScanDate: scans[0]?.scanTimestamp || null,
      recentScans: scans.slice(0, 5),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching dashboard stats',
    });
  }
});

// Get endpoint exposure timeline
router.get('/endpoint-exposure-timeline', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const scans = await Scan.find({
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
    const grouped: Record<string, number[]> = {};
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching timeline',
    });
  }
});

// Get top endpoints
router.get('/top-endpoints', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    
    const scans = await Scan.find({
      userId: req.userId,
      status: 'completed',
    })
      .sort({ scanTimestamp: -1 })
      .limit(10)
      .lean();

    const endpointMap: Record<string, {
      endpoint: string;
      cvssScores: number[];
      vulnerabilities: Set<string>;
      maxCVSS: number;
    }> = {};

    scans.forEach(scan => {
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
            endpointMap[endpoint].cvssScores.push(vuln.cvssScore);
            endpointMap[endpoint].vulnerabilities.add(vuln.cveId);
            endpointMap[endpoint].maxCVSS = Math.max(
              endpointMap[endpoint].maxCVSS,
              vuln.cvssScore
            );
          });
        }
      });
    });

    const endpoints = Object.values(endpointMap)
      .map(ep => ({
        endpoint: ep.endpoint,
        exposureScore: Math.round(
          (10 - ep.cvssScores.reduce((a, b) => a + b, 0) / ep.cvssScores.length) * 10
        ),
        vulnerabilities: Array.from(ep.vulnerabilities),
        riskLevel: ep.maxCVSS >= 9 ? 'critical' as const :
                   ep.maxCVSS >= 7 ? 'high' as const :
                   ep.maxCVSS >= 4 ? 'medium' as const : 'low' as const,
        recommendation: `Update affected software to patch ${ep.vulnerabilities.size} vulnerability${ep.vulnerabilities.size !== 1 ? 'ies' : ''}`,
      }))
      .sort((a, b) => b.exposureScore - a.exposureScore)
      .slice(0, limit);

    res.json({
      success: true,
      endpoints,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching top endpoints',
    });
  }
});

// Get top vulnerable software
router.get('/top-vulnerable-software', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    
    const scans = await Scan.find({
      userId: req.userId,
      status: 'completed',
    })
      .sort({ scanTimestamp: -1 })
      .lean();

    const softwareMap: Record<string, {
      name: string;
      version: string;
      devices: Set<string>;
      cves: Set<string>;
      maxCVSS: number;
      latestCVE: string;
    }> = {};

    scans.forEach(scan => {
      scan.vulnerabilities.items.forEach(vuln => {
        const key = `${vuln.software}-${vuln.version}`;
        if (!softwareMap[key]) {
          softwareMap[key] = {
            name: vuln.software,
            version: vuln.version,
            devices: new Set(),
            cves: new Set(),
            maxCVSS: 0,
            latestCVE: vuln.cveId,
          };
        }
        softwareMap[key].devices.add(scan.deviceId);
        softwareMap[key].cves.add(vuln.cveId);
        softwareMap[key].maxCVSS = Math.max(softwareMap[key].maxCVSS, vuln.cvssScore);
        if (vuln.cveId > softwareMap[key].latestCVE) {
          softwareMap[key].latestCVE = vuln.cveId;
        }
      });
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
        if (b.highestCVSS !== a.highestCVSS) return b.highestCVSS - a.highestCVSS;
        return b.cveCount - a.cveCount;
      })
      .slice(0, limit);

    res.json({
      success: true,
      software,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching vulnerable software',
    });
  }
});

// Get vulnerability insights
router.get('/vulnerability-insights', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const scans = await Scan.find({
      userId: req.userId,
      status: 'completed',
    })
      .sort({ scanTimestamp: -1 })
      .lean();

    const allVulns = scans.flatMap(s => s.vulnerabilities.items);
    
    const total = allVulns.length;
    const critical = allVulns.filter(v => v.severity === 'critical').length;
    const high = allVulns.filter(v => v.severity === 'high').length;
    const medium = allVulns.filter(v => v.severity === 'medium').length;
    const low = allVulns.filter(v => v.severity === 'low').length;
    const exploitable = allVulns.filter(v => v.exploitable).length;

    // Mock categories
    const byCategory: Record<string, number> = {
      'Remote Code Execution': allVulns.filter(v => v.description.toLowerCase().includes('code execution')).length,
      'Privilege Escalation': allVulns.filter(v => v.description.toLowerCase().includes('privilege')).length,
      'Information Disclosure': allVulns.filter(v => v.description.toLowerCase().includes('information') || v.description.toLowerCase().includes('disclosure')).length,
      'Denial of Service': allVulns.filter(v => v.description.toLowerCase().includes('denial') || v.description.toLowerCase().includes('dos')).length,
      'Cross-Site Scripting': allVulns.filter(v => v.description.toLowerCase().includes('xss') || v.description.toLowerCase().includes('scripting')).length,
    };

    // Calculate trend (last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const lastWeek = scans.filter(s => new Date(s.scanTimestamp) >= sevenDaysAgo)
      .reduce((sum, s) => sum + (s.vulnerabilities?.total || 0), 0);
    const previousWeek = scans.filter(
      s => new Date(s.scanTimestamp) >= fourteenDaysAgo && new Date(s.scanTimestamp) < sevenDaysAgo
    ).reduce((sum, s) => sum + (s.vulnerabilities?.total || 0), 0);

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching insights',
    });
  }
});

// Get top remediation activities
router.get('/top-remediation-activities', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    
    const scans = await Scan.find({
      userId: req.userId,
      status: 'completed',
    })
      .sort({ scanTimestamp: -1 })
      .limit(20)
      .lean();

    const activities = await getTopRemediationActivities(scans as any, limit);

    res.json({
      success: true,
      activities,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching remediation activities',
    });
  }
});

// Get daily checklist
router.get('/daily-checklist', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
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
          { id: 1, task: 'Run system scan', completed: false },
          { id: 2, task: 'Review critical vulnerabilities', completed: false },
          { id: 3, task: 'Update at least one vulnerable software', completed: false },
          { id: 4, task: 'Check for Windows updates', completed: false },
          { id: 5, task: 'Review browser extensions', completed: false },
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching checklist',
    });
  }
});

// Update checklist item
router.put('/daily-checklist/:itemId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { completed } = req.body;
    const itemId = parseInt(req.params.itemId);

    const user = await User.findById(req.userId);
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
          { id: 1, task: 'Run system scan', completed: false },
          { id: 2, task: 'Review critical vulnerabilities', completed: false },
          { id: 3, task: 'Update at least one vulnerable software', completed: false },
          { id: 4, task: 'Check for Windows updates', completed: false },
          { id: 5, task: 'Review browser extensions', completed: false },
        ],
      };
    }

    const item = user.dailyChecklist.items.find(i => i.id === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Checklist item not found' });
    }

    item.completed = completed;
    if (completed) {
      item.completedAt = new Date();
    } else {
      item.completedAt = undefined;
    }

    await user.save();

    const completedCount = user.dailyChecklist.items.filter(i => i.completed).length;
    const newCompletionPercentage = Math.round(
      (completedCount / user.dailyChecklist.items.length) * 100
    );

    res.json({
      success: true,
      item,
      newCompletionPercentage,
      scoreImpact: completed ? +2 : -2,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating checklist',
    });
  }
});

export default router;

