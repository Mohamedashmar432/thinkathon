import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Routes
import authRoutes from './routes/auth';
import scannerRoutes from './routes/scanner';
import scanRoutes from './routes/scans';
import dashboardRoutes from './routes/dashboard';
import organizationRoutes from './routes/organization';

dotenv.config({ path: path.join(__dirname, '../app.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - More lenient for development
const isDevelopment = process.env.NODE_ENV === 'development';

const authLimiter = rateLimit({
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

const scanLimiter = rateLimit({
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
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 200 : 50, // 200 requests in dev, 50 in production
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/scanner', apiLimiter, scannerRoutes);
app.use('/api/scan', scanLimiter, scanRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/organization', apiLimiter, organizationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thinkathon')
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
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

export default app;

