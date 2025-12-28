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
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
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

