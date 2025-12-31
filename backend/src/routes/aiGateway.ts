import express from 'express';
import { aiGateway } from '../services/ai/aiGateway';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

/**
 * Get AI Gateway health status and statistics
 * GET /api/ai-gateway/health
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const healthCheck = await aiGateway.healthCheck();
    
    res.json({
      success: true,
      data: healthCheck
    });
  } catch (error) {
    console.error('Error getting AI Gateway health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI Gateway health status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get AI Gateway statistics
 * GET /api/ai-gateway/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = aiGateway.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting AI Gateway stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI Gateway statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Reset AI Gateway statistics (admin only)
 * POST /api/ai-gateway/reset
 */
router.post('/reset', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Only allow admin users to reset stats
    if (req.user?.email !== 'ashmar@thinkbridge.in') {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can reset AI Gateway statistics'
      });
    }
    
    aiGateway.resetStats();
    
    res.json({
      success: true,
      message: 'AI Gateway statistics reset successfully'
    });
  } catch (error) {
    console.error('Error resetting AI Gateway stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset AI Gateway statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test AI Gateway with a simple prompt
 * POST /api/ai-gateway/test
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required and must be a string'
      });
    }
    
    if (prompt.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Prompt must be less than 1000 characters'
      });
    }
    
    const response = await aiGateway.generateResponse(prompt);
    
    res.json({
      success: true,
      data: {
        response: response.response,
        provider: response.provider,
        fallbackUsed: response.fallbackUsed,
        processingTimeMs: response.processingTimeMs
      }
    });
  } catch (error) {
    console.error('Error testing AI Gateway:', error);
    res.status(500).json({
      success: false,
      message: 'AI Gateway test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;