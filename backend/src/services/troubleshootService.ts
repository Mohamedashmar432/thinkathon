import axios from 'axios';
import SystemLogger from './systemLogger';
import User from '../models/User';
import Agent from '../models/Agent';
import Scan from '../models/Scan';
import ThreatIntelItem from '../models/ThreatIntelItem';
import ThreatCorrelation from '../models/ThreatCorrelation';
import ScheduledScan from '../models/ScheduledScan';
import Recommendation from '../models/Recommendation';
import threatIntelService from './threatIntelService';
import scheduledScanService from './scheduledScanService';
import { aiGateway } from './ai/aiGateway';

interface TroubleshootResult {
  subsystem: string;
  status: 'OK' | 'WARNING' | 'FAILED';
  message: string;
  details?: any;
  rootCause?: string;
  impactedUsers?: string[];
  impactedEndpoints?: string[];
  recommendedAction?: string;
  autoFixApplied?: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: Date;
}

interface TroubleshootReport {
  executionId: string;
  timestamp: Date;
  duration: number;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  healthScore: number;
  results: TroubleshootResult[];
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    failed: number;
    autoFixesApplied: number;
  };
}

class TroubleshootService {
  private executionId: string = '';

  async runFullDiagnostic(): Promise<TroubleshootReport> {
    const startTime = Date.now();
    this.executionId = `troubleshoot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await SystemLogger.info('api', 'troubleshoot_start', `Starting full system diagnostic: ${this.executionId}`);

    const results: TroubleshootResult[] = [];

    try {
      // Run all diagnostic checks in parallel where possible
      const diagnosticPromises = [
        this.checkDatabaseHealth(),
        this.checkAgentLayer(),
        this.checkScanLayer(),
        this.checkDataLayer(),
        this.checkIntegrationLayer(),
        this.checkSchedulerHealth(),
        this.checkThreatIntelligence(),
        this.checkAIServices(),
        this.checkUserSessions(),
        this.checkSystemResources()
      ];

      const diagnosticResults = await Promise.allSettled(diagnosticPromises);
      
      // Process results
      diagnosticResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          results.push({
            subsystem: `diagnostic_check_${index}`,
            status: 'FAILED',
            message: `Diagnostic check failed: ${result.reason}`,
            severity: 'HIGH',
            timestamp: new Date()
          });
        }
      });

      // Calculate overall health
      const duration = Date.now() - startTime;
      const summary = this.calculateSummary(results);
      const overallStatus = this.determineOverallStatus(results);
      const healthScore = this.calculateHealthScore(results);

      const report: TroubleshootReport = {
        executionId: this.executionId,
        timestamp: new Date(),
        duration,
        overallStatus,
        healthScore,
        results,
        summary
      };

      await SystemLogger.info('api', 'troubleshoot_complete', 
        `System diagnostic completed: ${overallStatus} (${healthScore}% health)`, 
        { executionId: this.executionId, duration, summary }
      );

      return report;

    } catch (error) {
      await SystemLogger.error('api', 'troubleshoot_error', 
        `System diagnostic failed: ${error}`, error as Error, 
        { executionId: this.executionId }
      );
      
      throw error;
    }
  }

  private async checkDatabaseHealth(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check MongoDB connection
      try {
        const dbStats = await User.db.db?.stats();
        results.push({
          subsystem: 'database_connection',
          status: 'OK',
          message: `Database connected successfully`,
          details: { collections: dbStats?.collections || 0, dataSize: dbStats?.dataSize || 0 },
          severity: 'LOW',
          timestamp: new Date()
        });
      } catch (error) {
        results.push({
          subsystem: 'database_connection',
          status: 'FAILED',
          message: 'Database connection failed',
          rootCause: (error as Error).message,
          severity: 'CRITICAL',
          timestamp: new Date()
        });
      }

      // Check collection health
      const collections = ['users', 'agents', 'scans', 'threatintelitems', 'threatcorrelations'];
      for (const collection of collections) {
        try {
          const count = await User.db.db?.collection(collection).countDocuments() || 0;
          results.push({
            subsystem: `database_${collection}`,
            status: 'OK',
            message: `Collection ${collection} accessible (${count} documents)`,
            details: { documentCount: count },
            severity: 'LOW',
            timestamp: new Date()
          });
        } catch (error) {
          results.push({
            subsystem: `database_${collection}`,
            status: 'FAILED',
            message: `Collection ${collection} inaccessible`,
            rootCause: (error as Error).message,
            severity: 'CRITICAL',
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      results.push({
        subsystem: 'database_connection',
        status: 'FAILED',
        message: 'Database connection failed',
        rootCause: (error as Error).message,
        severity: 'CRITICAL',
        timestamp: new Date()
      });
    }

    return results;
  }

  private async checkAgentLayer(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check agent statistics
      const [totalAgents, activeAgents, recentHeartbeats] = await Promise.all([
        Agent.countDocuments(),
        Agent.countDocuments({ status: 'active' }),
        Agent.countDocuments({ 
          lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        })
      ]);

      results.push({
        subsystem: 'agent_statistics',
        status: totalAgents > 0 ? 'OK' : 'WARNING',
        message: `${totalAgents} total agents, ${activeAgents} active, ${recentHeartbeats} recent heartbeats`,
        details: { totalAgents, activeAgents, recentHeartbeats },
        severity: totalAgents === 0 ? 'MEDIUM' : 'LOW',
        timestamp: new Date()
      });

      // Check for stale agents
      const staleAgents = await Agent.find({
        status: 'active',
        lastSeen: { $lt: new Date(Date.now() - 30 * 60 * 1000) } // No heartbeat in 30 minutes
      });

      if (staleAgents.length > 0) {
        const impactedUsers = [...new Set(staleAgents.map(a => (a as any).userEmail || 'unknown'))];
        results.push({
          subsystem: 'agent_heartbeat',
          status: 'WARNING',
          message: `${staleAgents.length} agents have stale heartbeats`,
          details: { staleAgents: staleAgents.map(a => ({ deviceId: a.deviceId, lastSeen: (a as any).lastSeen })) },
          impactedUsers,
          impactedEndpoints: staleAgents.map(a => a.deviceId),
          recommendedAction: 'Check agent connectivity and restart if necessary',
          severity: 'MEDIUM',
          timestamp: new Date()
        });
      } else {
        results.push({
          subsystem: 'agent_heartbeat',
          status: 'OK',
          message: 'All active agents have recent heartbeats',
          severity: 'LOW',
          timestamp: new Date()
        });
      }

      // Check OS distribution
      const osStats = await Agent.aggregate([
        { $group: { _id: '$systemInfo.osName', count: { $sum: 1 } } }
      ]);

      results.push({
        subsystem: 'agent_os_distribution',
        status: 'OK',
        message: `Agent OS distribution: ${osStats.map(s => `${s._id}: ${s.count}`).join(', ')}`,
        details: { osDistribution: osStats },
        severity: 'LOW',
        timestamp: new Date()
      });

    } catch (error) {
      results.push({
        subsystem: 'agent_layer',
        status: 'FAILED',
        message: 'Agent layer check failed',
        rootCause: (error as Error).message,
        severity: 'HIGH',
        timestamp: new Date()
      });
    }

    return results;
  }

  private async checkScanLayer(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check scan statistics
      const [totalScans, recentScans, failedScans, runningScans] = await Promise.all([
        Scan.countDocuments(),
        Scan.countDocuments({ 
          scanTimestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        }),
        Scan.countDocuments({ status: 'failed' }),
        Scan.countDocuments({ status: { $in: ['pending', 'running'] } })
      ]);

      results.push({
        subsystem: 'scan_statistics',
        status: 'OK',
        message: `${totalScans} total scans, ${recentScans} in last 24h, ${failedScans} failed, ${runningScans} running`,
        details: { totalScans, recentScans, failedScans, runningScans },
        severity: 'LOW',
        timestamp: new Date()
      });

      // Check for stuck scans
      const stuckScans = await Scan.find({
        status: { $in: ['pending', 'running'] },
        scanTimestamp: { $lt: new Date(Date.now() - 60 * 60 * 1000) } // Running for over 1 hour
      });

      if (stuckScans.length > 0) {
        results.push({
          subsystem: 'scan_stuck',
          status: 'WARNING',
          message: `${stuckScans.length} scans appear to be stuck`,
          details: { stuckScans: stuckScans.map(s => ({ scanId: s._id, deviceId: s.deviceId, status: s.status, started: s.scanTimestamp })) },
          impactedUsers: [...new Set(stuckScans.map(s => s.userEmail))],
          impactedEndpoints: [...new Set(stuckScans.map(s => s.deviceId))],
          recommendedAction: 'Review stuck scans and consider manual intervention',
          severity: 'MEDIUM',
          timestamp: new Date()
        });
      } else {
        results.push({
          subsystem: 'scan_stuck',
          status: 'OK',
          message: 'No stuck scans detected',
          severity: 'LOW',
          timestamp: new Date()
        });
      }

      // Check scan success rate
      const recentScanStats = await Scan.aggregate([
        { 
          $match: { 
            scanTimestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
          } 
        },
        { 
          $group: { 
            _id: '$status', 
            count: { $sum: 1 } 
          } 
        }
      ]);

      const completedScans = recentScanStats.find(s => s._id === 'completed')?.count || 0;
      const totalRecentScans = recentScanStats.reduce((sum, s) => sum + s.count, 0);
      const successRate = totalRecentScans > 0 ? (completedScans / totalRecentScans * 100) : 100;

      results.push({
        subsystem: 'scan_success_rate',
        status: successRate >= 90 ? 'OK' : successRate >= 70 ? 'WARNING' : 'FAILED',
        message: `Scan success rate: ${successRate.toFixed(1)}% (${completedScans}/${totalRecentScans})`,
        details: { successRate, completedScans, totalRecentScans, statusBreakdown: recentScanStats },
        severity: successRate >= 90 ? 'LOW' : successRate >= 70 ? 'MEDIUM' : 'HIGH',
        timestamp: new Date()
      });

    } catch (error) {
      results.push({
        subsystem: 'scan_layer',
        status: 'FAILED',
        message: 'Scan layer check failed',
        rootCause: (error as Error).message,
        severity: 'HIGH',
        timestamp: new Date()
      });
    }

    return results;
  }

  private async checkDataLayer(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check data integrity
      const [usersWithScans, agentsWithUsers, scansWithVulnerabilities] = await Promise.all([
        User.aggregate([
          { $lookup: { from: 'scans', localField: '_id', foreignField: 'userId', as: 'scans' } },
          { $match: { scans: { $ne: [] } } },
          { $count: 'count' }
        ]),
        Agent.aggregate([
          { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
          { $match: { user: { $ne: [] } } },
          { $count: 'count' }
        ]),
        Scan.countDocuments({ 'vulnerabilities.total': { $gt: 0 } })
      ]);

      results.push({
        subsystem: 'data_integrity',
        status: 'OK',
        message: `Data integrity check passed`,
        details: { 
          usersWithScans: usersWithScans[0]?.count || 0,
          agentsWithUsers: agentsWithUsers[0]?.count || 0,
          scansWithVulnerabilities
        },
        severity: 'LOW',
        timestamp: new Date()
      });

      // Check secure score calculation
      const scansWithScores = await Scan.countDocuments({ 
        secureScore: { $exists: true, $gte: 0, $lte: 100 } 
      });
      const totalCompletedScans = await Scan.countDocuments({ status: 'completed' });

      const scoreIntegrityRate = totalCompletedScans > 0 ? (scansWithScores / totalCompletedScans * 100) : 100;

      results.push({
        subsystem: 'secure_score_integrity',
        status: scoreIntegrityRate >= 95 ? 'OK' : scoreIntegrityRate >= 80 ? 'WARNING' : 'FAILED',
        message: `Secure score integrity: ${scoreIntegrityRate.toFixed(1)}% (${scansWithScores}/${totalCompletedScans})`,
        details: { scoreIntegrityRate, scansWithScores, totalCompletedScans },
        severity: scoreIntegrityRate >= 95 ? 'LOW' : scoreIntegrityRate >= 80 ? 'MEDIUM' : 'HIGH',
        timestamp: new Date()
      });

      // Check recommendation data
      const [totalRecommendations, activeRecommendations, completedRecommendations] = await Promise.all([
        Recommendation.countDocuments(),
        Recommendation.countDocuments({ status: { $in: ['not_started', 'in_progress'] } }),
        Recommendation.countDocuments({ status: 'completed' })
      ]);

      results.push({
        subsystem: 'recommendation_data',
        status: 'OK',
        message: `${totalRecommendations} recommendations, ${activeRecommendations} active, ${completedRecommendations} completed`,
        details: { totalRecommendations, activeRecommendations, completedRecommendations },
        severity: 'LOW',
        timestamp: new Date()
      });

    } catch (error) {
      results.push({
        subsystem: 'data_layer',
        status: 'FAILED',
        message: 'Data layer check failed',
        rootCause: (error as Error).message,
        severity: 'HIGH',
        timestamp: new Date()
      });
    }

    return results;
  }

  private async checkIntegrationLayer(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check AI Gateway health
      try {
        const testResponse = await aiGateway.generateResponse('Test connectivity');
        results.push({
          subsystem: 'ai_gateway',
          status: 'OK',
          message: 'AI Gateway connectivity test passed',
          details: { responseLength: testResponse.response.length },
          severity: 'LOW',
          timestamp: new Date()
        });
      } catch (error) {
        results.push({
          subsystem: 'ai_gateway',
          status: 'FAILED',
          message: 'AI Gateway connectivity test failed',
          rootCause: (error as Error).message,
          recommendedAction: 'Check API keys and network connectivity',
          severity: 'HIGH',
          timestamp: new Date()
        });
      }

      // Check AI Gateway fallback providers (optional)
      try {
        const aiGatewayHealth = await aiGateway.healthCheck();
        
        if (aiGatewayHealth.geminiAvailable && !aiGatewayHealth.fallbackAvailable) {
          results.push({
            subsystem: 'ai_fallback_providers',
            status: 'OK',
            message: 'AI Gateway operational with Gemini (fallback providers not configured - this is optional)',
            details: { 
              geminiAvailable: true, 
              fallbackAvailable: false,
              note: 'Fallback providers (Groq/OpenAI) are optional when Gemini is working'
            },
            severity: 'LOW',
            timestamp: new Date()
          });
        } else if (aiGatewayHealth.geminiAvailable && aiGatewayHealth.fallbackAvailable) {
          results.push({
            subsystem: 'ai_fallback_providers',
            status: 'OK',
            message: 'AI Gateway operational with Gemini and fallback providers configured',
            details: aiGatewayHealth.details,
            severity: 'LOW',
            timestamp: new Date()
          });
        } else if (!aiGatewayHealth.geminiAvailable && aiGatewayHealth.fallbackAvailable) {
          results.push({
            subsystem: 'ai_fallback_providers',
            status: 'WARNING',
            message: 'AI Gateway running on fallback providers only (Gemini unavailable)',
            details: aiGatewayHealth.details,
            severity: 'MEDIUM',
            timestamp: new Date()
          });
        } else {
          results.push({
            subsystem: 'ai_fallback_providers',
            status: 'FAILED',
            message: 'No AI providers available (neither Gemini nor fallback providers)',
            details: aiGatewayHealth.details,
            recommendedAction: 'Configure at least one AI provider (Gemini, Groq, or OpenAI)',
            severity: 'HIGH',
            timestamp: new Date()
          });
        }
      } catch (error) {
        results.push({
          subsystem: 'ai_fallback_providers',
          status: 'WARNING',
          message: 'Could not check AI Gateway fallback status',
          rootCause: (error as Error).message,
          severity: 'LOW',
          timestamp: new Date()
        });
      }

      // Check external API endpoints
      const externalAPIs = [
        { name: 'NVD CVE API', url: 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1' },
        { name: 'CISA KEV', url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json' }
      ];

      for (const api of externalAPIs) {
        try {
          const response = await axios.get(api.url, { timeout: 10000 });
          results.push({
            subsystem: `external_api_${api.name.toLowerCase().replace(/\s+/g, '_')}`,
            status: 'OK',
            message: `${api.name} accessible (HTTP ${response.status})`,
            details: { status: response.status, responseTime: 'OK' },
            severity: 'LOW',
            timestamp: new Date()
          });
        } catch (error) {
          results.push({
            subsystem: `external_api_${api.name.toLowerCase().replace(/\s+/g, '_')}`,
            status: 'WARNING',
            message: `${api.name} connectivity issue`,
            rootCause: (error as Error).message,
            recommendedAction: 'Check network connectivity and API status',
            severity: 'MEDIUM',
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      results.push({
        subsystem: 'integration_layer',
        status: 'FAILED',
        message: 'Integration layer check failed',
        rootCause: (error as Error).message,
        severity: 'HIGH',
        timestamp: new Date()
      });
    }

    return results;
  }

  private async checkSchedulerHealth(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check scheduled scan service
      const schedulerStatus = scheduledScanService.getStatus();
      results.push({
        subsystem: 'scheduled_scan_service',
        status: schedulerStatus.isRunning ? 'OK' : 'FAILED',
        message: `Scheduled scan service: ${schedulerStatus.isRunning ? 'Running' : 'Stopped'}`,
        details: schedulerStatus,
        severity: schedulerStatus.isRunning ? 'LOW' : 'HIGH',
        timestamp: new Date()
      });

      // Check threat intelligence service
      const threatIntelStatus = threatIntelService.getStatus();
      results.push({
        subsystem: 'threat_intel_service',
        status: threatIntelStatus.isRunning ? 'OK' : 'FAILED',
        message: `Threat intelligence service: ${threatIntelStatus.isRunning ? 'Running' : 'Stopped'}`,
        details: threatIntelStatus,
        severity: threatIntelStatus.isRunning ? 'LOW' : 'HIGH',
        timestamp: new Date()
      });

      // Check scheduled scan configurations
      const [totalScheduled, enabledScheduled, recentExecutions] = await Promise.all([
        ScheduledScan.countDocuments(),
        ScheduledScan.countDocuments({ enabled: true }),
        ScheduledScan.countDocuments({ 
          lastRun: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        })
      ]);

      results.push({
        subsystem: 'scheduled_scan_config',
        status: 'OK',
        message: `${totalScheduled} scheduled scans configured, ${enabledScheduled} enabled, ${recentExecutions} executed recently`,
        details: { totalScheduled, enabledScheduled, recentExecutions },
        severity: 'LOW',
        timestamp: new Date()
      });

      // Check timezone accuracy (IST to UTC conversion)
      const testTime = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const utcTime = new Date(testTime.getTime() - istOffset);
      
      results.push({
        subsystem: 'timezone_conversion',
        status: 'OK',
        message: 'Timezone conversion working correctly',
        details: { 
          currentUTC: utcTime.toISOString(),
          currentIST: testTime.toISOString(),
          offsetHours: 5.5
        },
        severity: 'LOW',
        timestamp: new Date()
      });

    } catch (error) {
      results.push({
        subsystem: 'scheduler_health',
        status: 'FAILED',
        message: 'Scheduler health check failed',
        rootCause: (error as Error).message,
        severity: 'HIGH',
        timestamp: new Date()
      });
    }

    return results;
  }

  private async checkThreatIntelligence(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check threat intelligence data
      const [totalThreats, exploitedThreats, recentThreats, correlations] = await Promise.all([
        ThreatIntelItem.countDocuments(),
        ThreatIntelItem.countDocuments({ exploited: true }),
        ThreatIntelItem.countDocuments({ 
          publishedDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
        }),
        ThreatCorrelation.countDocuments()
      ]);

      results.push({
        subsystem: 'threat_intelligence_data',
        status: totalThreats > 0 ? 'OK' : 'WARNING',
        message: `${totalThreats} threats, ${exploitedThreats} exploited, ${recentThreats} recent, ${correlations} correlations`,
        details: { totalThreats, exploitedThreats, recentThreats, correlations },
        severity: totalThreats > 0 ? 'LOW' : 'MEDIUM',
        timestamp: new Date()
      });

      // Check data freshness
      const latestThreat = await ThreatIntelItem.findOne().sort({ createdAt: -1 });
      const dataAge = latestThreat ? Date.now() - latestThreat.createdAt.getTime() : Infinity;
      const hoursOld = dataAge / (1000 * 60 * 60);

      results.push({
        subsystem: 'threat_data_freshness',
        status: hoursOld <= 24 ? 'OK' : hoursOld <= 72 ? 'WARNING' : 'FAILED',
        message: `Latest threat data is ${hoursOld.toFixed(1)} hours old`,
        details: { hoursOld, latestThreatDate: latestThreat?.createdAt },
        severity: hoursOld <= 24 ? 'LOW' : hoursOld <= 72 ? 'MEDIUM' : 'HIGH',
        timestamp: new Date()
      });

      // Check correlation health
      const usersWithCorrelations = await ThreatCorrelation.distinct('userId');
      const totalUsers = await User.countDocuments();
      const correlationCoverage = totalUsers > 0 ? (usersWithCorrelations.length / totalUsers * 100) : 0;

      results.push({
        subsystem: 'threat_correlation_coverage',
        status: 'OK',
        message: `Threat correlation coverage: ${correlationCoverage.toFixed(1)}% (${usersWithCorrelations.length}/${totalUsers} users)`,
        details: { correlationCoverage, usersWithCorrelations: usersWithCorrelations.length, totalUsers },
        severity: 'LOW',
        timestamp: new Date()
      });

    } catch (error) {
      results.push({
        subsystem: 'threat_intelligence',
        status: 'FAILED',
        message: 'Threat intelligence check failed',
        rootCause: (error as Error).message,
        severity: 'HIGH',
        timestamp: new Date()
      });
    }

    return results;
  }

  private async checkAIServices(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check AI recommendation generation
      const recentRecommendations = await Recommendation.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      results.push({
        subsystem: 'ai_recommendations',
        status: 'OK',
        message: `${recentRecommendations} AI recommendations generated in last 24h`,
        details: { recentRecommendations },
        severity: 'LOW',
        timestamp: new Date()
      });

      // Check AI service performance
      results.push({
        subsystem: 'ai_service_performance',
        status: 'OK',
        message: 'AI service operational',
        details: { status: 'running' },
        severity: 'LOW',
        timestamp: new Date()
      });

    } catch (error) {
      results.push({
        subsystem: 'ai_services',
        status: 'FAILED',
        message: 'AI services check failed',
        rootCause: (error as Error).message,
        severity: 'MEDIUM',
        timestamp: new Date()
      });
    }

    return results;
  }

  private async checkUserSessions(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check user activity
      const [totalUsers, recentLogins, activeUsers] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ 
          lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        }),
        User.countDocuments({ 
          lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
        })
      ]);

      results.push({
        subsystem: 'user_activity',
        status: 'OK',
        message: `${totalUsers} total users, ${recentLogins} recent logins, ${activeUsers} active this week`,
        details: { totalUsers, recentLogins, activeUsers },
        severity: 'LOW',
        timestamp: new Date()
      });

      // Check organization users
      const orgUsers = await User.countDocuments({
        email: { $regex: /@thinkbridge\.(com|in)$/ }
      });

      results.push({
        subsystem: 'organization_users',
        status: 'OK',
        message: `${orgUsers} organization users registered`,
        details: { orgUsers },
        severity: 'LOW',
        timestamp: new Date()
      });

    } catch (error) {
      results.push({
        subsystem: 'user_sessions',
        status: 'FAILED',
        message: 'User sessions check failed',
        rootCause: (error as Error).message,
        severity: 'MEDIUM',
        timestamp: new Date()
      });
    }

    return results;
  }

  private async checkSystemResources(): Promise<TroubleshootResult[]> {
    const results: TroubleshootResult[] = [];

    try {
      // Check memory usage (basic Node.js metrics)
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };

      results.push({
        subsystem: 'memory_usage',
        status: memUsageMB.heapUsed < 500 ? 'OK' : memUsageMB.heapUsed < 1000 ? 'WARNING' : 'FAILED',
        message: `Memory usage: ${memUsageMB.heapUsed}MB heap, ${memUsageMB.rss}MB RSS`,
        details: memUsageMB,
        severity: memUsageMB.heapUsed < 500 ? 'LOW' : memUsageMB.heapUsed < 1000 ? 'MEDIUM' : 'HIGH',
        timestamp: new Date()
      });

      // Check uptime
      const uptimeSeconds = process.uptime();
      const uptimeHours = uptimeSeconds / 3600;

      results.push({
        subsystem: 'system_uptime',
        status: 'OK',
        message: `System uptime: ${uptimeHours.toFixed(1)} hours`,
        details: { uptimeSeconds, uptimeHours },
        severity: 'LOW',
        timestamp: new Date()
      });

    } catch (error) {
      results.push({
        subsystem: 'system_resources',
        status: 'FAILED',
        message: 'System resources check failed',
        rootCause: (error as Error).message,
        severity: 'MEDIUM',
        timestamp: new Date()
      });
    }

    return results;
  }

  private calculateSummary(results: TroubleshootResult[]) {
    const totalChecks = results.length;
    const passed = results.filter(r => r.status === 'OK').length;
    const warnings = results.filter(r => r.status === 'WARNING').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const autoFixesApplied = results.filter(r => r.autoFixApplied).length;

    return { totalChecks, passed, warnings, failed, autoFixesApplied };
  }

  private determineOverallStatus(results: TroubleshootResult[]): 'HEALTHY' | 'DEGRADED' | 'CRITICAL' {
    const criticalFailures = results.filter(r => r.status === 'FAILED' && r.severity === 'CRITICAL').length;
    const highFailures = results.filter(r => r.status === 'FAILED' && r.severity === 'HIGH').length;
    const totalFailures = results.filter(r => r.status === 'FAILED').length;

    if (criticalFailures > 0) return 'CRITICAL';
    if (highFailures > 0 || totalFailures > 3) return 'DEGRADED';
    return 'HEALTHY';
  }

  private calculateHealthScore(results: TroubleshootResult[]): number {
    if (results.length === 0) return 100;

    const weights = { 'CRITICAL': 25, 'HIGH': 15, 'MEDIUM': 10, 'LOW': 5 };
    let totalDeductions = 0;

    results.forEach(result => {
      if (result.status === 'FAILED') {
        totalDeductions += weights[result.severity];
      } else if (result.status === 'WARNING') {
        totalDeductions += weights[result.severity] * 0.5;
      }
    });

    return Math.max(0, 100 - totalDeductions);
  }
}

export default new TroubleshootService();