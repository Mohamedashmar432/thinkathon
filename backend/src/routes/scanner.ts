import express, { Response } from 'express';
import fs from 'fs';
import path from 'path';
import User from '../models/User';
import { generateApiKey } from '../utils/apiKeyGenerator';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Generate personalized scanner script
router.post('/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate API key if not exists
    if (!user.apiKey) {
      user.apiKey = generateApiKey(user.email);
      await user.save();
    }

    // Read template
    const templatePath = path.join(__dirname, '../../templates/scanner_template.ps1');
    let template = fs.readFileSync(templatePath, 'utf-8');

    // Replace placeholders
    const isProduction = process.env.NODE_ENV === 'production' || 
                        process.env.RENDER === 'true' || 
                        !process.env.API_BASE_URL ||
                        process.env.API_BASE_URL.includes('onrender.com');
    
    const apiEndpoint = isProduction
      ? 'https://secure-habit-backend.onrender.com/api/scan/submit'
      : `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/scan/submit`;
    
    template = template
      .replace(/\{\{USER_EMAIL\}\}/g, user.email)
      .replace(/\{\{API_ENDPOINT\}\}/g, apiEndpoint)
      .replace(/\{\{API_KEY\}\}/g, user.apiKey);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="scanner.ps1"');
    
    res.send(template);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating scanner',
    });
  }
});

// Get API credentials
router.get('/credentials', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate API key if not exists
    if (!user.apiKey) {
      user.apiKey = generateApiKey(user.email);
      await user.save();
    }

    const isProduction = process.env.NODE_ENV === 'production' || 
                        process.env.RENDER === 'true' || 
                        !process.env.API_BASE_URL ||
                        process.env.API_BASE_URL.includes('onrender.com');

    res.json({
      success: true,
      apiKey: user.apiKey,
      apiEndpoint: isProduction
        ? 'https://secure-habit-backend.onrender.com/api/scan/submit'
        : `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/scan/submit`,
      userEmail: user.email,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching credentials',
    });
  }
});

export default router;

