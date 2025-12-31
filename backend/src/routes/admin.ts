import express from 'express';
import SystemLogger from '../services/systemLogger';
import troubleshootService from '../services/troubleshootService';
import User from '../models/User';
import Agent from '../models/Agent';
import Scan from '../models/Scan';
import ThreatIntelItem from '../models/ThreatIntelItem';
import ThreatCorrelation from '../models/ThreatCorrelation';
import ScheduledScan from '../models/ScheduledScan';
import Recommendation from '../models/Recommendation';

const router = express.Router();

// Admin authentication middleware
const adminAuth = async (req: express.Request & { user?: any; userId?: string }, res: express.Response, next: express.NextFunction) => {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    const user = await User.findById(decoded.userId).select('-password');

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
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
};

// Get system overview
router.get('/overview', adminAuth, async (req: express.Request & { user?: any }, res: express.Response) => {
  try {
    await SystemLogger.info('api', 'admin_overview_access', 
      `Admin ${req.user.email} accessed system overview`);

    const [
      totalUsers,
      totalAgents,
      totalScans,
      totalThreats,
      totalCorrelations,
      totalScheduledScans,
      totalRecommendations,
      recentErrors
    ] = await Promise.all([
      User.countDocuments(),
      Agent.countDocuments(),
      Scan.countDocuments(),
      ThreatIntelItem.countDocuments(),
      ThreatCorrelation.countDocuments(),
      ScheduledScan.countDocuments(),
      Recommendation.countDocuments(),
      SystemLogger.getLogs({
        level: ['error'],
        limit: 10,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
      })
    ]);

    const overview = {
      users: {
        total: totalUsers,
        active: await User.countDocuments({ 
          lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
        }),
        organization: await User.countDocuments({
          email: { $regex: /@thinkbridge\.(com|in)$/ }
        })
      },
      agents: {
        total: totalAgents,
        active: await Agent.countDocuments({ status: 'active' }),
        windows: await Agent.countDocuments({ 'systemInfo.osName': /windows/i }),
        linux: await Agent.countDocuments({ 'systemInfo.osName': /linux/i }),
        macos: await Agent.countDocuments({ 'systemInfo.osName': /darwin|mac/i })
      },
      scans: {
        total: totalScans,
        completed: await Scan.countDocuments({ status: 'completed' }),
        failed: await Scan.countDocuments({ status: 'failed' }),
        recent: await Scan.countDocuments({ 
          scanTimestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        })
      },
      threats: {
        total: totalThreats,
        exploited: await ThreatIntelItem.countDocuments({ exploited: true }),
        correlations: totalCorrelations,
        recent: await ThreatIntelItem.countDocuments({ 
          publishedDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
        })
      },
      scheduled: {
        total: totalScheduledScans,
        enabled: await ScheduledScan.countDocuments({ enabled: true }),
        recent: await ScheduledScan.countDocuments({ 
          lastRun: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        })
      },
      recommendations: {
        total: totalRecommendations,
        active: await Recommendation.countDocuments({ status: { $in: ['not_started', 'in_progress'] } }),
        completed: await Recommendation.countDocuments({ status: 'completed' })
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

  } catch (error) {
    await SystemLogger.error('api', 'admin_overview_error', 
      `Admin overview failed: ${error}`, error as Error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system overview'
    });
  }
});

// Get all users (admin view)
router.get('/users', adminAuth, async (req: express.Request & { user?: any }, res: express.Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({}, '-password')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      User.countDocuments()
    ]);

    // Enrich with agent and scan counts
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const [agentCount, scanCount, lastScan] = await Promise.all([
          Agent.countDocuments({ userId: user._id }),
          Scan.countDocuments({ userId: user._id }),
          Scan.findOne({ userId: user._id }).sort({ scanTimestamp: -1 }).lean()
        ]);

        return {
          ...user,
          agentCount,
          scanCount,
          lastScanDate: lastScan?.scanTimestamp
        };
      })
    );

    await SystemLogger.info('api', 'admin_users_access', 
      `Admin ${req.user.email} accessed user list (page ${page})`);

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

  } catch (error) {
    await SystemLogger.error('api', 'admin_users_error', 
      `Admin users list failed: ${error}`, error as Error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Get all agents (admin view)
router.get('/agents', adminAuth, async (req: express.Request & { user?: any }, res: express.Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [agents, total] = await Promise.all([
      Agent.find()
        .populate('userId', 'email firstName lastName')
        .sort({ lastSeen: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Agent.countDocuments()
    ]);

    await SystemLogger.info('api', 'admin_agents_access', 
      `Admin ${req.user.email} accessed agent list (page ${page})`);

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

  } catch (error) {
    await SystemLogger.error('api', 'admin_agents_error', 
      `Admin agents list failed: ${error}`, error as Error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agents'
    });
  }
});

// Run system troubleshoot
router.post('/troubleshoot', adminAuth, async (req: express.Request & { user?: any }, res: express.Response) => {
  try {
    await SystemLogger.info('api', 'admin_troubleshoot_start', 
      `Admin ${req.user.email} initiated system troubleshoot`);

    const report = await troubleshootService.runFullDiagnostic();

    await SystemLogger.info('api', 'admin_troubleshoot_complete', 
      `System troubleshoot completed by ${req.user.email}`, 
      { 
        executionId: report.executionId,
        overallStatus: report.overallStatus,
        healthScore: report.healthScore,
        duration: report.duration
      });

    res.json({
      success: true,
      report
    });

  } catch (error) {
    await SystemLogger.error('api', 'admin_troubleshoot_error', 
      `System troubleshoot failed: ${error}`, error as Error);
    
    res.status(500).json({
      success: false,
      message: 'Troubleshoot execution failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get system logs
router.get('/logs', adminAuth, async (req: express.Request & { user?: any }, res: express.Response) => {
  try {
    const filters = {
      level: req.query.level ? (req.query.level as string).split(',') : undefined,
      component: req.query.component ? (req.query.component as string).split(',') : undefined,
      success: req.query.success ? req.query.success === 'true' : undefined,
      userId: req.query.userId as string,
      deviceId: req.query.deviceId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      search: req.query.search as string,
      limit: Math.min(parseInt(req.query.limit as string) || 100, 1000),
      skip: parseInt(req.query.skip as string) || 0
    };

    const result = await SystemLogger.getLogs(filters);

    await SystemLogger.info('api', 'admin_logs_access', 
      `Admin ${req.user.email} accessed system logs`, 
      { filters: { ...filters, startDate: filters.startDate?.toISOString(), endDate: filters.endDate?.toISOString() } });

    res.json({
      success: true,
      logs: result.logs,
      total: result.total,
      filters
    });

  } catch (error) {
    await SystemLogger.error('api', 'admin_logs_error', 
      `Admin logs access failed: ${error}`, error as Error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs'
    });
  }
});

// Get system health metrics
router.get('/health', adminAuth, async (req: express.Request & { user?: any }, res: express.Response) => {
  try {
    const timeRange = parseInt(req.query.timeRange as string) || 24;
    const metrics = await SystemLogger.getHealthMetrics(timeRange);

    await SystemLogger.info('api', 'admin_health_access', 
      `Admin ${req.user.email} accessed health metrics`);

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    await SystemLogger.error('api', 'admin_health_error', 
      `Admin health metrics failed: ${error}`, error as Error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch health metrics'
    });
  }
});

// Get specific user details
router.get('/users/:userId', adminAuth, async (req: express.Request & { user?: any }, res: express.Response) => {
  try {
    const { userId } = req.params;

    const [user, agents, scans, recommendations] = await Promise.all([
      User.findById(userId, '-password').lean(),
      Agent.find({ userId }).lean(),
      Scan.find({ userId }).sort({ scanTimestamp: -1 }).limit(10).lean(),
      Recommendation.find({ userId }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await SystemLogger.info('api', 'admin_user_detail_access', 
      `Admin ${req.user.email} accessed user details for ${user.email}`);

    res.json({
      success: true,
      user: {
        ...user,
        agents,
        recentScans: scans,
        recentRecommendations: recommendations
      }
    });

  } catch (error) {
    await SystemLogger.error('api', 'admin_user_detail_error', 
      `Admin user detail failed: ${error}`, error as Error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details'
    });
  }
});

// System actions
router.post('/actions/clear-logs', adminAuth, async (req: express.Request & { user?: any }, res: express.Response) => {
  try {
    const { olderThan } = req.body; // Days
    const cutoffDate = new Date(Date.now() - (olderThan || 30) * 24 * 60 * 60 * 1000);
    
    const result = await SystemLogger.getLogs({
      endDate: cutoffDate,
      limit: 1000
    });

    // Note: In production, you'd want to implement actual log cleanup
    // For now, we'll just log the action
    await SystemLogger.info('api', 'admin_clear_logs', 
      `Admin ${req.user.email} requested log cleanup (${result.total} logs older than ${olderThan} days)`);

    res.json({
      success: true,
      message: `Log cleanup requested for ${result.total} logs`,
      logsAffected: result.total
    });

  } catch (error) {
    await SystemLogger.error('api', 'admin_clear_logs_error', 
      `Admin log cleanup failed: ${error}`, error as Error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to clear logs'
    });
  }
});

export default router;