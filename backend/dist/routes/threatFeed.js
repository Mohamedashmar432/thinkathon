"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const ThreatIntelItem_1 = __importDefault(require("../models/ThreatIntelItem"));
const ThreatCorrelation_1 = __importDefault(require("../models/ThreatCorrelation"));
const threatIntelService_1 = __importDefault(require("../services/threatIntelService"));
const router = express_1.default.Router();
// Cache for feed results (5 minutes)
const feedCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
// Helper function to get cached result or execute query
async function getCachedResult(cacheKey, queryFn) {
    const cached = feedCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        return cached.data;
    }
    const result = await queryFn();
    feedCache.set(cacheKey, { data: result, timestamp: now });
    return result;
}
// Helper function to build query filters
function buildThreatQuery(filters) {
    const query = {};
    if (filters.severity) {
        query.severity = { $in: Array.isArray(filters.severity) ? filters.severity : [filters.severity] };
    }
    if (filters.exploited !== undefined) {
        query.exploited = filters.exploited === 'true';
    }
    if (filters.startDate || filters.endDate) {
        query.publishedDate = {};
        if (filters.startDate) {
            query.publishedDate.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            query.publishedDate.$lte = new Date(filters.endDate);
        }
    }
    return query;
}
// Helper function to build correlation query filters
function buildCorrelationQuery(userId, filters) {
    const query = { userId };
    if (filters.severity) {
        query['threatDetails.severity'] = { $in: Array.isArray(filters.severity) ? filters.severity : [filters.severity] };
    }
    if (filters.exploited !== undefined) {
        query['threatDetails.exploited'] = filters.exploited === 'true';
    }
    if (filters.minRiskScore) {
        query.riskScore = { $gte: parseInt(filters.minRiskScore) };
    }
    return query;
}
/**
 * GET /api/threat-feed/latest
 * Get latest threat intelligence items
 */
router.get('/latest', auth_1.authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, severity, exploited, startDate, endDate } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;
        const filters = { severity, exploited, startDate, endDate };
        const cacheKey = `latest_${JSON.stringify(filters)}_${pageNum}_${limitNum}`;
        const result = await getCachedResult(cacheKey, async () => {
            const query = buildThreatQuery(filters);
            const [threats, total] = await Promise.all([
                ThreatIntelItem_1.default.find(query)
                    .sort({ publishedDate: -1, cvssScore: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                ThreatIntelItem_1.default.countDocuments(query)
            ]);
            return {
                threats,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum)
                }
            };
        });
        res.json({
            success: true,
            ...result,
            filters: filters
        });
    }
    catch (error) {
        console.error('Error fetching latest threats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching latest threats'
        });
    }
});
/**
 * GET /api/threat-feed/exploited
 * Get actively exploited vulnerabilities (CISA KEV)
 */
router.get('/exploited', auth_1.authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, severity } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;
        const cacheKey = `exploited_${severity}_${pageNum}_${limitNum}`;
        const result = await getCachedResult(cacheKey, async () => {
            const query = { exploited: true };
            if (severity) {
                query.severity = { $in: Array.isArray(severity) ? severity : [severity] };
            }
            const [threats, total] = await Promise.all([
                ThreatIntelItem_1.default.find(query)
                    .sort({ cisaKevDate: -1, cvssScore: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                ThreatIntelItem_1.default.countDocuments(query)
            ]);
            return {
                threats,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum)
                }
            };
        });
        res.json({
            success: true,
            ...result
        });
    }
    catch (error) {
        console.error('Error fetching exploited threats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching exploited threats'
        });
    }
});
/**
 * GET /api/threat-feed/high-risk
 * Get high-risk threats (critical/high severity, high CVSS)
 */
router.get('/high-risk', auth_1.authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, minCvss = 7.0 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;
        const minCvssScore = parseFloat(minCvss);
        const cacheKey = `high_risk_${minCvssScore}_${pageNum}_${limitNum}`;
        const result = await getCachedResult(cacheKey, async () => {
            const query = {
                $and: [
                    { cvssScore: { $gte: minCvssScore } },
                    { severity: { $in: ['critical', 'high'] } }
                ]
            };
            const [threats, total] = await Promise.all([
                ThreatIntelItem_1.default.find(query)
                    .sort({ cvssScore: -1, publishedDate: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                ThreatIntelItem_1.default.countDocuments(query)
            ]);
            return {
                threats,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum)
                }
            };
        });
        res.json({
            success: true,
            ...result
        });
    }
    catch (error) {
        console.error('Error fetching high-risk threats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching high-risk threats'
        });
    }
});
/**
 * GET /api/threat-feed/impacted
 * Get threats that impact user's environment
 */
router.get('/impacted', auth_1.authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, severity, exploited, minRiskScore = 0 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;
        const filters = { severity, exploited, minRiskScore };
        const cacheKey = `impacted_${req.userId}_${JSON.stringify(filters)}_${pageNum}_${limitNum}`;
        const result = await getCachedResult(cacheKey, async () => {
            const query = buildCorrelationQuery(req.userId, filters);
            const [correlations, total] = await Promise.all([
                ThreatCorrelation_1.default.find(query)
                    .sort({ riskScore: -1, lastChecked: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .populate('cveId')
                    .lean(),
                ThreatCorrelation_1.default.countDocuments(query)
            ]);
            // Enrich correlations with threat details
            const enrichedCorrelations = await Promise.all(correlations.map(async (correlation) => {
                const threatDetails = await ThreatIntelItem_1.default.findOne({ cveId: correlation.cveId }).lean();
                return {
                    ...correlation,
                    threatDetails: threatDetails || correlation.threatDetails
                };
            }));
            return {
                threats: enrichedCorrelations,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum)
                }
            };
        });
        res.json({
            success: true,
            ...result,
            filters: filters
        });
    }
    catch (error) {
        console.error('Error fetching impacted threats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching impacted threats'
        });
    }
});
/**
 * GET /api/threat-feed/:cveId
 * Get detailed information about a specific CVE
 */
router.get('/:cveId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { cveId } = req.params;
        // Validate CVE ID format
        if (!/^CVE-\d{4}-\d{4,}$/i.test(cveId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid CVE ID format'
            });
        }
        const cveIdUpper = cveId.toUpperCase();
        // Get threat details
        const threatDetails = await ThreatIntelItem_1.default.findOne({ cveId: cveIdUpper }).lean();
        if (!threatDetails) {
            return res.status(404).json({
                success: false,
                message: 'CVE not found in threat intelligence database'
            });
        }
        // Get user's correlation data if it exists
        const userCorrelation = await ThreatCorrelation_1.default.findOne({
            cveId: cveIdUpper,
            userId: req.userId
        }).lean();
        res.json({
            success: true,
            threat: threatDetails,
            userImpact: userCorrelation || null,
            isImpacted: !!userCorrelation
        });
    }
    catch (error) {
        console.error('Error fetching CVE details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching CVE details'
        });
    }
});
/**
 * GET /api/threat-feed/stats/overview
 * Get threat intelligence statistics
 */
router.get('/stats/overview', auth_1.authenticateToken, async (req, res) => {
    try {
        const cacheKey = `stats_overview_${req.userId}`;
        const result = await getCachedResult(cacheKey, async () => {
            const [totalThreats, exploitedThreats, criticalThreats, userImpactedThreats, userHighRiskThreats] = await Promise.all([
                ThreatIntelItem_1.default.countDocuments({}),
                ThreatIntelItem_1.default.countDocuments({ exploited: true }),
                ThreatIntelItem_1.default.countDocuments({ severity: 'critical' }),
                ThreatCorrelation_1.default.countDocuments({ userId: req.userId }),
                ThreatCorrelation_1.default.countDocuments({
                    userId: req.userId,
                    riskScore: { $gte: 70 }
                })
            ]);
            // Get recent activity (last 7 days)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const recentThreats = await ThreatIntelItem_1.default.countDocuments({
                publishedDate: { $gte: sevenDaysAgo }
            });
            return {
                totalThreats,
                exploitedThreats,
                criticalThreats,
                userImpactedThreats,
                userHighRiskThreats,
                recentThreats,
                lastUpdated: new Date()
            };
        });
        res.json({
            success: true,
            stats: result
        });
    }
    catch (error) {
        console.error('Error fetching threat stats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching threat statistics'
        });
    }
});
/**
 * POST /api/threat-feed/trigger-ingestion
 * Manually trigger threat intelligence ingestion (admin only)
 */
router.post('/trigger-ingestion', auth_1.authenticateToken, async (req, res) => {
    try {
        // Only allow admin users to trigger manual ingestion
        if (req.user?.email !== 'ashmar@thinkbridge.in') {
            return res.status(403).json({
                success: false,
                message: 'Only admin users can trigger manual ingestion'
            });
        }
        await threatIntelService_1.default.triggerManualIngestion();
        res.json({
            success: true,
            message: 'Threat intelligence ingestion triggered successfully'
        });
    }
    catch (error) {
        console.error('Error triggering ingestion:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error triggering threat intelligence ingestion'
        });
    }
});
/**
 * GET /api/threat-feed/service/status
 * Get threat intelligence service status
 */
router.get('/service/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const status = threatIntelService_1.default.getStatus();
        // Get additional statistics
        const [totalItems, lastIngestion] = await Promise.all([
            ThreatIntelItem_1.default.countDocuments({}),
            ThreatIntelItem_1.default.findOne({}).sort({ createdAt: -1 }).select('createdAt').lean()
        ]);
        res.json({
            success: true,
            status: {
                ...status,
                totalItems,
                lastItemIngested: lastIngestion?.createdAt || null
            }
        });
    }
    catch (error) {
        console.error('Error fetching service status:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching service status'
        });
    }
});
exports.default = router;
