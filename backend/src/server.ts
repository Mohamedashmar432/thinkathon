import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Load environment variables first
dotenv.config({ path: path.join(__dirname, '../app.env') });

// Routes
import authRoutes from './routes/auth';
import scannerRoutes from './routes/scanner';
import scanRoutes from './routes/scans';
import dashboardRoutes from './routes/dashboard';
import organizationRoutes from './routes/organization';
import agentRoutes, { setupWebSocketServer } from './routes/agent';
import recommendationsRoutes from './routes/recommendations';
import organizationScoreRoutes from './routes/organizationScore';
import userRecommendationsRoutes from './routes/userRecommendations';
import aiGatewayRoutes from './routes/aiGateway';
import scheduledScansRoutes from './routes/scheduledScans';
import threatFeedRoutes from './routes/threatFeed';
import adminRoutes from './routes/admin';

// Import models to ensure they're registered with Mongoose
import './models/User';
import './models/Scan';
import './models/Agent';
import './models/Recommendation';
import './models/ScheduledScan';
import './models/LLMCache';
import './models/ThreatIntelItem';
import './models/ThreatCorrelation';

// Import services
import scheduledScanService from './services/scheduledScanService';
import threatIntelService from './services/threatIntelService';

const app = express();
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
// CORS configuration with production-first approach
const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = isProduction 
  ? 'https://securehabit.vercel.app' 
  : (process.env.FRONTEND_URL || 'http://localhost:5173');

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://securehabit.vercel.app',
    'https://securehabit.vercel.app/',
    frontendUrl,
    // Add Vercel preview URLs
    /^https:\/\/.*\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-User-Email'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - More lenient for development
const isDevelopment = process.env.NODE_ENV === 'development';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 100 : 20, // 100 requests in dev, 20 in production
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

const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 50 : 15, // 50 scans in dev, 15 in production
  message: {
    success: false,
    message: 'Too many scan submissions, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter (more lenient)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 200 : 100, // 200 requests in dev, 100 in production
  standardHeaders: true,
  legacyHeaders: false,
});

// Threat feed rate limiter (very lenient for real-time updates)
const threatFeedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 500 : 200, // 500 requests in dev, 200 in production
  message: {
    success: false,
    message: 'Too many threat feed requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/scanner', apiLimiter, scannerRoutes);
app.use('/api/scan', scanLimiter, scanRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/organization', apiLimiter, organizationRoutes);
app.use('/api/agent', apiLimiter, agentRoutes);
app.use('/api/recommendations', apiLimiter, recommendationsRoutes);
app.use('/api/organization-score', apiLimiter, organizationScoreRoutes);
app.use('/api/user-recommendations', apiLimiter, userRecommendationsRoutes);
app.use('/api/ai-gateway', apiLimiter, aiGatewayRoutes);
app.use('/api/scheduled-scans', apiLimiter, scheduledScansRoutes);
app.use('/api/threat-feed', threatFeedLimiter, threatFeedRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

// Health check endpoint with detailed status
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({ 
    status: 'ok',
    service: 'secure-habit-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
    },
    environment: process.env.NODE_ENV || 'development',
    mongodb: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host || 'unknown'
    },
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      unit: 'MB'
    },
    keepAlive: {
      enabled: process.env.NODE_ENV === 'production',
      lastPing: new Date().toISOString()
    }
  });
});

// Additional health endpoints for monitoring
app.get('/api/health', (req, res) => {
  res.redirect(301, '/health');
});

app.get('/ping', (req, res) => {
  res.json({ 
    pong: true, 
    timestamp: new Date().toISOString(),
    server: 'secure-habit-backend'
  });
});

app.get('/api/ping', (req, res) => {
  res.redirect(301, '/ping');
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

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thinkathon')
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔑 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'Missing'}`);
      console.log(`🎯 Frontend URL: ${frontendUrl}`);
    });

    // Setup WebSocket server for agent communication
    setupWebSocketServer(server);
    console.log('🔌 WebSocket server setup complete');
    
    // Initialize scheduled scan service
    console.log('📅 Initializing scheduled scan service...');
    // Service is already initialized as singleton in the import
    
    // Initialize threat intelligence service
    console.log('🔍 Initializing threat intelligence service...');
    // Service is already initialized as singleton in the import
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    console.error('Connection string:', process.env.MONGODB_URI ? 'Configured' : 'Missing');
    process.exit(1);
  });

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Keep-alive system to prevent Render free tier from spinning down
if (process.env.NODE_ENV === 'production') {
  console.log('🔄 Initializing keep-alive system for production...');
  
  // Self-ping every 14 minutes (Render spins down after 15 minutes of inactivity)
  const keepAliveInterval = setInterval(async () => {
    try {
      const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://secure-habit-backend.onrender.com';
      
      // Primary health check
      const healthResponse = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: { 'User-Agent': 'KeepAlive-Internal/1.0' }
      });
      
      if (healthResponse.ok) {
        console.log(`✅ Keep-alive ping successful: ${healthResponse.status} at ${new Date().toISOString()}`);
        
        // Additional warmup requests to keep different services active
        try {
          await fetch(`${baseUrl}/api/dashboard/stats`, { 
            method: 'GET',
            headers: { 'User-Agent': 'KeepAlive-Internal/1.0' }
          });
          await fetch(`${baseUrl}/api/agent/stats/overview`, { 
            method: 'GET',
            headers: { 'User-Agent': 'KeepAlive-Internal/1.0' }
          });
        } catch (warmupError) {
          // Warmup failures are non-critical
          console.log('Warmup requests completed with some failures');
        }
      } else {
        console.log(`⚠️ Keep-alive ping returned: ${healthResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ Keep-alive ping failed: ${(error as Error).message}`);
    }
  }, 14 * 60 * 1000); // Every 14 minutes
  
  // Cleanup on process termination
  process.on('SIGTERM', () => {
    console.log('🛑 Cleaning up keep-alive system...');
    clearInterval(keepAliveInterval);
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 Cleaning up keep-alive system...');
    clearInterval(keepAliveInterval);
  });
}

export default app;