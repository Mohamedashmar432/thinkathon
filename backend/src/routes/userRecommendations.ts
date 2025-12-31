import express, { Response } from 'express';
import Recommendation from '../models/Recommendation';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get user's recommendations
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId, status, priority, category, limit = 20 } = req.query;
    
    const query: any = { userId: req.userId };
    
    if (deviceId) query.deviceId = deviceId;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    
    const recommendations = await Recommendation.find(query)
      .sort({ priority: -1, expectedRiskReduction: -1, createdAt: -1 })
      .limit(parseInt(limit as string))
      .lean();

    // Group recommendations by priority
    const grouped = {
      high: recommendations.filter(r => r.priority === 'high'),
      medium: recommendations.filter(r => r.priority === 'medium'),
      low: recommendations.filter(r => r.priority === 'low')
    };

    // Calculate statistics
    const stats = {
      total: recommendations.length,
      notStarted: recommendations.filter(r => r.status === 'not_started').length,
      inProgress: recommendations.filter(r => r.status === 'in_progress').length,
      completed: recommendations.filter(r => r.status === 'completed').length,
      totalRiskReduction: recommendations
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + r.expectedRiskReduction, 0)
    };

    res.json({
      success: true,
      recommendations,
      grouped,
      stats
    });
  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching recommendations'
    });
  }
});

// Get recommendation by ID
router.get('/:recommendationId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const recommendation = await Recommendation.findOne({
      recommendationId: req.params.recommendationId,
      userId: req.userId
    });

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found'
      });
    }

    res.json({
      success: true,
      recommendation
    });
  } catch (error: any) {
    console.error('Error fetching recommendation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching recommendation'
    });
  }
});

// Update recommendation status
router.put('/:recommendationId/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!['not_started', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: not_started, in_progress, or completed'
      });
    }

    const recommendation = await Recommendation.findOneAndUpdate(
      {
        recommendationId: req.params.recommendationId,
        userId: req.userId
      },
      { 
        status,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found'
      });
    }

    // Log the status change
    console.log(`Recommendation ${recommendation.recommendationId} status changed to ${status} by user ${req.userId}`);

    res.json({
      success: true,
      recommendation,
      message: `Recommendation marked as ${status}`
    });
  } catch (error: any) {
    console.error('Error updating recommendation status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating recommendation status'
    });
  }
});

// Mark recommendation as completed
router.post('/:recommendationId/complete', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const recommendation = await Recommendation.findOneAndUpdate(
      {
        recommendationId: req.params.recommendationId,
        userId: req.userId
      },
      { 
        status: 'completed',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found'
      });
    }

    console.log(`Recommendation completed: ${recommendation.title} (Risk reduction: ${recommendation.expectedRiskReduction})`);

    res.json({
      success: true,
      recommendation,
      message: 'Recommendation marked as completed',
      riskReduction: recommendation.expectedRiskReduction
    });
  } catch (error: any) {
    console.error('Error completing recommendation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing recommendation'
    });
  }
});

// Get recommendations dashboard summary
router.get('/dashboard/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId } = req.query;
    
    const query: any = { userId: req.userId };
    if (deviceId) query.deviceId = deviceId;

    const recommendations = await Recommendation.find(query).lean();

    // Calculate summary statistics
    const summary = {
      total: recommendations.length,
      highPriority: recommendations.filter(r => r.priority === 'high').length,
      completed: recommendations.filter(r => r.status === 'completed').length,
      inProgress: recommendations.filter(r => r.status === 'in_progress').length,
      notStarted: recommendations.filter(r => r.status === 'not_started').length,
      totalRiskReduction: recommendations
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + r.expectedRiskReduction, 0),
      potentialRiskReduction: recommendations
        .filter(r => r.status !== 'completed')
        .reduce((sum, r) => sum + r.expectedRiskReduction, 0),
      completionRate: recommendations.length > 0 
        ? Math.round((recommendations.filter(r => r.status === 'completed').length / recommendations.length) * 100)
        : 0,
      categories: {
        endpoint: recommendations.filter(r => r.category === 'endpoint').length,
        system: recommendations.filter(r => r.category === 'system').length,
        network: recommendations.filter(r => r.category === 'network').length,
        application: recommendations.filter(r => r.category === 'application').length
      },
      recentRecommendations: recommendations
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(r => ({
          recommendationId: r.recommendationId,
          title: r.title,
          priority: r.priority,
          status: r.status,
          expectedRiskReduction: r.expectedRiskReduction,
          createdAt: r.createdAt
        }))
    };

    res.json({
      success: true,
      summary
    });
  } catch (error: any) {
    console.error('Error fetching recommendations summary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching recommendations summary'
    });
  }
});

// Delete recommendation (for testing/cleanup)
router.delete('/:recommendationId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const recommendation = await Recommendation.findOneAndDelete({
      recommendationId: req.params.recommendationId,
      userId: req.userId
    });

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found'
      });
    }

    res.json({
      success: true,
      message: 'Recommendation deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting recommendation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting recommendation'
    });
  }
});

export default router;