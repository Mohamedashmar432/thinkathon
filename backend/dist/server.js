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
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
// Load environment variables first
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../app.env') });
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const scanner_1 = __importDefault(require("./routes/scanner"));
const scans_1 = __importDefault(require("./routes/scans"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const organization_1 = __importDefault(require("./routes/organization"));
const agent_1 = __importStar(require("./routes/agent"));
const recommendations_1 = __importDefault(require("./routes/recommendations"));
const organizationScore_1 = __importDefault(require("./routes/organizationScore"));
const userRecommendations_1 = __importDefault(require("./routes/userRecommendations"));
const aiGateway_1 = __importDefault(require("./routes/aiGateway"));
const scheduledScans_1 = __importDefault(require("./routes/scheduledScans"));
// Import models to ensure they're registered with Mongoose
require("./models/User");
require("./models/Scan");
require("./models/Agent");
require("./models/Recommendation");
require("./models/ScheduledScan");
require("./models/LLMCache");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Validate required environment variables
if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is required');
    process.exit(1);
}
if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
}
// Middleware
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.FRONTEND_URL || 'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-User-Email'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Rate limiting - More lenient for development
const isDevelopment = process.env.NODE_ENV === 'development';
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDevelopment ? 100 : 10, // 100 requests in dev, 10 in production
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
    },
});
const scanLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDevelopment ? 50 : 10, // 50 scans in dev, 10 in production
    message: {
        success: false,
        message: 'Too many scan submissions, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// General API rate limiter (more lenient)
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDevelopment ? 200 : 50, // 200 requests in dev, 50 in production
    standardHeaders: true,
    legacyHeaders: false,
});
// Routes
app.use('/api/auth', authLimiter, auth_1.default);
app.use('/api/scanner', apiLimiter, scanner_1.default);
app.use('/api/scan', scanLimiter, scans_1.default);
app.use('/api/dashboard', apiLimiter, dashboard_1.default);
app.use('/api/organization', apiLimiter, organization_1.default);
app.use('/api/agent', apiLimiter, agent_1.default);
app.use('/api/recommendations', apiLimiter, recommendations_1.default);
app.use('/api/organization-score', apiLimiter, organizationScore_1.default);
app.use('/api/user-recommendations', apiLimiter, userRecommendations_1.default);
app.use('/api/ai-gateway', apiLimiter, aiGateway_1.default);
app.use('/api/scheduled-scans', apiLimiter, scheduledScans_1.default);
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        mongodb: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});
// Test endpoint for debugging
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working',
        timestamp: new Date().toISOString(),
        headers: req.headers
    });
});
// Connect to MongoDB
console.log('Connecting to MongoDB...');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
mongoose_1.default
    .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thinkathon')
    .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    // Start server
    const server = app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔑 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'Missing'}`);
        console.log(`🎯 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });
    // Setup WebSocket server for agent communication
    (0, agent_1.setupWebSocketServer)(server);
    console.log('🔌 WebSocket server setup complete');
    // Initialize scheduled scan service
    console.log('📅 Initializing scheduled scan service...');
    // Service is already initialized as singleton in the import
})
    .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    console.error('Connection string:', process.env.MONGODB_URI ? 'Configured' : 'Missing');
    process.exit(1);
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
    });
});
exports.default = app;
