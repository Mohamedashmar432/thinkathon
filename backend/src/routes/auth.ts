import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Extract domain for organization detection
    const emailParts = email.toLowerCase().split('@');
    const domain = emailParts.length === 2 ? emailParts[1] : '';
    
    // Auto-detect organization for thinkbridge domains
    let organization = '';
    if (domain === 'thinkbridge.com' || domain === 'thinkbridge.in') {
      organization = 'ThinkBridge';
    }

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      organization,
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({
      success: true,
      token,
      user: userObj,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating user',
    });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    res.json({
      success: true,
      token,
      user: userObj,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error logging in',
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching user',
    });
  }
});

export default router;

