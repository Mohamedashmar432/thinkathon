import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
  userId?: string;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('No token provided in request');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    console.log('Verifying JWT token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    console.log('Finding user by ID:', decoded.userId);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      console.log('User not found for token:', decoded.userId);
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    req.userId = user._id.toString();
    console.log('Authentication successful for user:', user.email);
    next();
  } catch (error: any) {
    console.error('Token authentication error:', error.message);
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || !process.env.JWT_SECRET) {
      // No token provided or JWT secret not configured - continue without auth
      console.log('No authentication provided, continuing as guest');
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      const user = await User.findById(decoded.userId).select('-password');

      if (user) {
        req.user = user;
        req.userId = user._id.toString();
        console.log('Optional authentication successful for user:', user.email);
      }
    } catch (error) {
      // Invalid token - continue without auth
      console.log('Invalid token provided, continuing as guest');
    }

    next();
  } catch (error: any) {
    console.error('Optional auth error:', error.message);
    next(); // Continue even if there's an error
  }
};

export const authenticateApiKey = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers['x-api-key'] as string;
    const userEmail = req.headers['x-user-email'] as string;

    console.log('API Key Authentication Debug:', {
      hasApiKey: !!apiKey,
      hasUserEmail: !!userEmail,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : 'None',
      userEmail: userEmail || 'None',
      headers: {
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        'x-api-key': req.headers['x-api-key'] ? 'Present' : 'Missing',
        'x-user-email': req.headers['x-user-email'] || 'Missing'
      }
    });

    if (!apiKey) {
      console.error('API key missing in request');
      return res.status(401).json({ 
        success: false, 
        message: 'API key required. Please provide Authorization header with Bearer token or X-API-Key header.',
        debug: {
          authHeader: !!req.headers.authorization,
          apiKeyHeader: !!req.headers['x-api-key']
        }
      });
    }

    if (!userEmail) {
      console.error('User email missing in request');
      return res.status(401).json({ 
        success: false, 
        message: 'User email required. Please provide X-User-Email header.',
        debug: {
          userEmailHeader: !!req.headers['x-user-email']
        }
      });
    }

    // Find user by API key and email with enhanced validation
    const user = await User.findOne({ 
      apiKey: apiKey.trim(), 
      email: userEmail.toLowerCase().trim() 
    });

    if (!user) {
      console.error('Invalid API key or user email:', {
        apiKeyPreview: `${apiKey.substring(0, 8)}...`,
        userEmail: userEmail,
        apiKeyLength: apiKey.length
      });
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid API key or user email. Please re-download the agent from your dashboard.',
        debug: {
          apiKeyFormat: apiKey.length === 32 ? 'Valid length' : `Invalid length: ${apiKey.length}`,
          emailFormat: userEmail.includes('@') ? 'Valid format' : 'Invalid format'
        }
      });
    }

    console.log('✅ API key authentication successful:', {
      userId: user._id,
      userEmail: user.email,
      apiKeyValid: true
    });

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error: any) {
    console.error('API key authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

