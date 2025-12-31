"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SystemLog_1 = __importDefault(require("../models/SystemLog"));
class SystemLogger {
    constructor() { }
    static getInstance() {
        if (!SystemLogger.instance) {
            SystemLogger.instance = new SystemLogger();
        }
        return SystemLogger.instance;
    }
    async log(entry) {
        try {
            const logData = {
                timestamp: new Date(),
                level: entry.level,
                component: entry.component,
                action: entry.action,
                message: entry.message,
                userId: entry.userId,
                userEmail: entry.userEmail,
                deviceId: entry.deviceId,
                scanId: entry.scanId,
                cveId: entry.cveId,
                correlationId: entry.correlationId,
                metadata: this.sanitizeMetadata(entry.metadata),
                duration: entry.duration,
                success: entry.success,
                ipAddress: entry.ipAddress,
                userAgent: entry.userAgent
            };
            if (entry.error) {
                logData.error = {
                    name: entry.error.name,
                    message: entry.error.message,
                    stack: entry.error.stack,
                    code: entry.error.code
                };
            }
            await SystemLog_1.default.create(logData);
            // Also log to console for development
            if (process.env.NODE_ENV === 'development') {
                const logLevel = entry.level.toUpperCase();
                const timestamp = new Date().toISOString();
                console.log(`[${timestamp}] ${logLevel} [${entry.component}] ${entry.action}: ${entry.message}`);
                if (entry.error) {
                    console.error('Error details:', entry.error);
                }
                if (entry.metadata) {
                    console.log('Metadata:', entry.metadata);
                }
            }
        }
        catch (error) {
            // Fallback to console if database logging fails
            console.error('Failed to write system log:', error);
            console.log('Original log entry:', entry);
        }
    }
    // Convenience methods
    async info(component, action, message, metadata) {
        await this.log({
            level: 'info',
            component,
            action,
            message,
            metadata,
            success: true
        });
    }
    async warn(component, action, message, metadata) {
        await this.log({
            level: 'warn',
            component,
            action,
            message,
            metadata,
            success: false
        });
    }
    async error(component, action, message, error, metadata) {
        await this.log({
            level: 'error',
            component,
            action,
            message,
            error,
            metadata,
            success: false
        });
    }
    async debug(component, action, message, metadata) {
        await this.log({
            level: 'debug',
            component,
            action,
            message,
            metadata,
            success: true
        });
    }
    // User-specific logging
    async logUserAction(userId, userEmail, component, action, message, success, metadata, error) {
        await this.log({
            level: success ? 'info' : 'error',
            component,
            action,
            message,
            userId,
            userEmail,
            metadata,
            error,
            success
        });
    }
    // Agent-specific logging
    async logAgentAction(userId, userEmail, deviceId, action, message, success, metadata, error) {
        await this.log({
            level: success ? 'info' : 'error',
            component: 'agent',
            action,
            message,
            userId,
            userEmail,
            deviceId,
            metadata,
            error,
            success
        });
    }
    // Scan-specific logging
    async logScanAction(userId, userEmail, deviceId, scanId, action, message, success, duration, metadata, error) {
        await this.log({
            level: success ? 'info' : 'error',
            component: 'scan',
            action,
            message,
            userId,
            userEmail,
            deviceId,
            scanId,
            duration,
            metadata,
            error,
            success
        });
    }
    // Threat intelligence logging
    async logThreatAction(cveId, action, message, success, metadata, error) {
        await this.log({
            level: success ? 'info' : 'error',
            component: 'ingestion',
            action,
            message,
            cveId,
            metadata,
            error,
            success
        });
    }
    // Performance logging
    async logPerformance(component, action, duration, metadata) {
        const level = duration > 5000 ? 'warn' : 'info'; // Warn if over 5 seconds
        await this.log({
            level,
            component,
            action: `${action}_performance`,
            message: `Action completed in ${duration}ms`,
            duration,
            metadata,
            success: true
        });
    }
    // Sanitize metadata to remove sensitive information
    sanitizeMetadata(metadata) {
        if (!metadata)
            return metadata;
        const sanitized = JSON.parse(JSON.stringify(metadata));
        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'key', 'authorization'];
        const sanitizeObject = (obj) => {
            if (typeof obj !== 'object' || obj === null)
                return obj;
            for (const key in obj) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    obj[key] = '[REDACTED]';
                }
                else if (typeof obj[key] === 'object') {
                    obj[key] = sanitizeObject(obj[key]);
                }
            }
            return obj;
        };
        return sanitizeObject(sanitized);
    }
    // Get logs with filtering
    async getLogs(filters) {
        const query = {};
        if (filters.level && filters.level.length > 0) {
            query.level = { $in: filters.level };
        }
        if (filters.component && filters.component.length > 0) {
            query.component = { $in: filters.component };
        }
        if (filters.success !== undefined) {
            query.success = filters.success;
        }
        if (filters.userId) {
            query.userId = filters.userId;
        }
        if (filters.deviceId) {
            query.deviceId = filters.deviceId;
        }
        if (filters.startDate || filters.endDate) {
            query.timestamp = {};
            if (filters.startDate)
                query.timestamp.$gte = filters.startDate;
            if (filters.endDate)
                query.timestamp.$lte = filters.endDate;
        }
        if (filters.search) {
            query.$or = [
                { message: { $regex: filters.search, $options: 'i' } },
                { action: { $regex: filters.search, $options: 'i' } },
                { userEmail: { $regex: filters.search, $options: 'i' } }
            ];
        }
        const limit = Math.min(filters.limit || 100, 1000);
        const skip = filters.skip || 0;
        const [logs, total] = await Promise.all([
            SystemLog_1.default.find(query)
                .sort({ timestamp: -1 })
                .limit(limit)
                .skip(skip)
                .lean()
                .exec(),
            SystemLog_1.default.countDocuments(query)
        ]);
        return { logs: logs, total };
    }
    // Get system health metrics
    async getHealthMetrics(timeRange = 24) {
        const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
        const [totalLogs, errorLogs, componentStats, recentErrors, performanceStats] = await Promise.all([
            SystemLog_1.default.countDocuments({ timestamp: { $gte: startTime } }),
            SystemLog_1.default.countDocuments({ timestamp: { $gte: startTime }, level: 'error' }),
            SystemLog_1.default.aggregate([
                { $match: { timestamp: { $gte: startTime } } },
                { $group: { _id: '$component', count: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ['$level', 'error'] }, 1, 0] } } } }
            ]),
            SystemLog_1.default.find({
                timestamp: { $gte: startTime },
                level: 'error'
            }).sort({ timestamp: -1 }).limit(10).lean(),
            SystemLog_1.default.aggregate([
                { $match: { timestamp: { $gte: startTime }, duration: { $exists: true } } },
                { $group: { _id: '$component', avgDuration: { $avg: '$duration' }, maxDuration: { $max: '$duration' } } }
            ])
        ]);
        return {
            timeRange: `${timeRange} hours`,
            totalLogs,
            errorLogs,
            errorRate: totalLogs > 0 ? (errorLogs / totalLogs * 100).toFixed(2) : 0,
            componentStats,
            recentErrors,
            performanceStats,
            healthScore: totalLogs > 0 ? Math.max(0, 100 - (errorLogs / totalLogs * 100)) : 100
        };
    }
}
exports.default = SystemLogger.getInstance();
