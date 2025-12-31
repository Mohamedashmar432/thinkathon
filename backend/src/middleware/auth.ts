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

    if (!apiKey || !userEmail) {
      return res.status(401).json({ 
        success: false, 
        message: 'API key and user email required' 
      });
    }

    const user = await User.findOne({ 
      apiKey, 
      email: userEmail.toLowerCase() 
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid API credentials' });
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Authentication failed' });
  }
};

