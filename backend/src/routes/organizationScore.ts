import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import Scan from '../models/Scan';
import { calculateUserSecureScore } from '../utils/scoreCalculator';

const router = express.Router();

// Organization domains that are supported
const SUPPORTED_ORG_DOMAINS = ['thinkbridge.in', 'thinkbridge.com'];

// Check if user belongs to supported organization
function isOrganizationUser(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return SUPPORTED_ORG_DOMAINS.includes(domain);
}

// Get organization security score and user contribution
router.get('/score', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Fetching organization score for user:', req.userId);
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user belongs to supported organization
    if (!isOrganizationUser(user.email)) {
      return res.status(403).json({
        success: false,
        message: 'Organization features only available for ThinkBridge users'
      });
    }

    // FIXED ORGANIZATION SCORE as per requirements - ALWAYS 46.83%
    const FIXED_ORG_SCORE = 46.83;

    // Get current user's score for contribution calculation
    const userScans = await Scan.find({ userId: req.userId })
      .sort({ scanTimestamp: -1 })
      .limit(10);
    
    let currentUserScore = 50; // Default
    if (userScans.length > 0) {
      const calculatedScore = calculateUserSecureScore(userScans, user);
      currentUserScore = isNaN(calculatedScore) ? 50 : Math.max(0, Math.min(100, calculatedScore));
    }

    // Calculate user contribution (how much above/below fixed org score)
    const contributionScore = Math.round(currentUserScore - FIXED_ORG_SCORE);
    
    console.log('Organization score calculation:', {
      fixedOrgScore: FIXED_ORG_SCORE,
      currentUserScore,
      contributionScore
    });
    
    // Get all organization users for ranking
    const orgUsers = await User.find({
      $or: [
        { email: { $regex: /@thinkbridge\.com$/i } },
        { email: { $regex: /@thinkbridge\.in$/i } }
      ]
    });

    // Calculate scores for ranking
    const userScores: Array<{ userId: string; score: number; name: string; email: string }> = [];
    
    for (const orgUser of orgUsers) {
      const scans = await Scan.find({ userId: orgUser._id })
        .sort({ scanTimestamp: -1 })
        .limit(10);
      
      let score = 50; // Default
      if (scans.length > 0) {
        const calculatedScore = calculateUserSecureScore(scans, orgUser);
        score = isNaN(calculatedScore) ? 50 : Math.max(0, Math.min(100, calculatedScore));
      }
      
      userScores.push({
        userId: orgUser._id.toString(),
        score,
        name: `${orgUser.firstName || ''} ${orgUser.lastName || ''}`.trim() || 'User',
        email: orgUser.email
      });
    }

    // Calculate user ranking
    const sortedScores = userScores.sort((a, b) => b.score - a.score);
    const userRanking = sortedScores.findIndex(u => u.userId === req.userId) + 1;
    
    // Get top contributors (top 5)
    const topContributors = sortedScores.slice(0, 5).map(u => ({
      name: u.name,
      score: u.score,
      contribution: Math.round(u.score - FIXED_ORG_SCORE),
      isCurrentUser: u.userId === req.userId
    }));

    // Get total devices across organization
    const totalDevices = await Scan.distinct('deviceId', {
      userId: { $in: orgUsers.map(u => u._id) }
    });

    const response = {
      success: true,
      organizationScore: FIXED_ORG_SCORE,
      userContribution: contributionScore,
      totalMembers: orgUsers.length,
      totalDevices: totalDevices.length,
      ranking: {
        position: userRanking,
        outOf: userScores.length
      },
      topContributors,
      explanation: generateScoreExplanation(FIXED_ORG_SCORE, currentUserScore, contributionScore)
    };

    console.log('Organization score response:', response);
    res.json(response);

  } catch (error: any) {
    console.error('Error fetching organization score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization score'
    });
  }
});

// Get organization score history
router.get('/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !isOrganizationUser(user.email)) {
      return res.status(403).json({
        success: false,
        message: 'Organization features only available for ThinkBridge users'
      });
    }

    const days = parseInt(req.query.days as string) || 30;
    
    // Get organization users
    const orgUsers = await User.find({
      $or: [
        { email: { $regex: /@thinkbridge\.com$/i } },
        { email: { $regex: /@thinkbridge\.in$/i } }
      ]
    });

    // Generate mock history data (in production, this would be stored)
    const history = [];
    const baseScore = 46.83;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Simulate gradual improvement over time
      const improvement = (days - i) * 0.5;
      const randomVariation = (Math.random() - 0.5) * 4; // ±2% random variation
      const score = Math.min(100, Math.max(0, baseScore + improvement + randomVariation));
      
      history.push({
        date: date.toISOString().split('T')[0],
        score: Math.round(score * 100) / 100
      });
    }

    res.json({
      success: true,
      history,
      currentScore: history[history.length - 1]?.score || baseScore,
      trend: history.length > 1 ? 
        (history[history.length - 1].score - history[0].score) : 0
    });

  } catch (error: any) {
    console.error('Error fetching organization history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization history'
    });
  }
});

function generateScoreExplanation(orgScore: number, userScore: number, contribution: number): string {
  let explanation = `Your organization's security score is ${orgScore}%. `;
  
  if (contribution > 10) {
    explanation += `Great job! Your security practices are helping improve the organization's overall security by ${contribution}% above average.`;
  } else if (contribution > 0) {
    explanation += `You're contributing positively to the organization's security, scoring ${contribution}% above the average.`;
  } else if (contribution > -10) {
    explanation += `Your security score is close to the organization average. A few improvements could boost both your score and the organization's.`;
  } else {
    explanation += `There's room for improvement. By following security recommendations, you can help strengthen both your protection and the organization's overall security.`;
  }
  
  return explanation;
}

export default router;