import express, { Response } from 'express';
import User from '../models/User';
import Scan from '../models/Scan';
import Organization from '../models/Organization';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { calculateUserSecureScore } from '../utils/scoreCalculator';

const router = express.Router();

// Get organization score
router.get('/score', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Extract domain from email
    const emailParts = user.email.split('@');
    if (emailParts.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    const domain = emailParts[1];

    // Only allow thinkbridge.com and thinkbridge.in
    if (domain !== 'thinkbridge.com' && domain !== 'thinkbridge.in') {
      return res.status(403).json({
        success: false,
        message: 'Organization features only available for @thinkbridge.com and @thinkbridge.in users',
      });
    }

    // Get all users with thinkbridge.com or thinkbridge.in (same organization)
    const orgUsers = await User.find({
      $or: [
        { email: { $regex: /@thinkbridge\.com$/ } },
        { email: { $regex: /@thinkbridge\.in$/ } },
      ],
    });

    // Calculate scores for all users
    const userScores: Array<{ userId: string; score: number; name: string }> = [];
    
    for (const orgUser of orgUsers) {
      const scans = await Scan.find({ userId: orgUser._id })
        .sort({ scanTimestamp: -1 })
        .limit(10);
      
      if (scans.length > 0) {
        const score = calculateUserSecureScore(scans, orgUser);
        userScores.push({
          userId: orgUser._id.toString(),
          score,
          name: `${orgUser.firstName || ''} ${orgUser.lastName || ''}`.trim() || orgUser.email,
        });
      }
    }

    if (userScores.length === 0) {
      return res.json({
        success: true,
        organizationScore: 0,
        userContribution: 0,
        totalMembers: orgUsers.length,
        totalDevices: 0,
        ranking: { position: 0, outOf: orgUsers.length },
        topContributors: [],
      });
    }

    const organizationScore = Math.round(
      userScores.reduce((sum, u) => sum + u.score, 0) / userScores.length
    );

    const currentUserScore = userScores.find(u => u.userId === req.userId)?.score || 0;
    const userContribution = Math.round((currentUserScore / organizationScore) * 10);

    // Sort by score
    userScores.sort((a, b) => b.score - a.score);
    const userPosition = userScores.findIndex(u => u.userId === req.userId) + 1;

    const topContributors = userScores.slice(0, 5).map(u => ({
      name: u.name,
      score: u.score,
      contribution: Math.round((u.score / organizationScore) * 10),
    }));

    // Count unique devices
    const allScans = await Scan.find({
      userId: { $in: orgUsers.map(u => u._id) },
    });
    const uniqueDevices = new Set(allScans.map(s => s.deviceId)).size;

    // Update organization record (use 'thinkbridge.com' as primary domain)
    const primaryDomain = 'thinkbridge.com';
    await Organization.findOneAndUpdate(
      { domain: primaryDomain },
      {
        $set: {
          domain: primaryDomain,
          name: 'ThinkBridge',
          secureScore: organizationScore,
          totalMembers: orgUsers.length,
          totalDevices: uniqueDevices,
          updatedAt: new Date(),
        },
        $push: {
          scoreHistory: {
            $each: [{ date: new Date(), score: organizationScore }],
            $slice: -90, // Keep last 90 days
          },
        },
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      organizationScore,
      userContribution,
      totalMembers: orgUsers.length,
      totalDevices: uniqueDevices,
      ranking: {
        position: userPosition || 0,
        outOf: userScores.length,
      },
      topContributors,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching organization score',
    });
  }
});

// Get organization score history
router.get('/score-history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const emailParts = user.email.split('@');
    if (emailParts.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    const domain = emailParts[1];

    if (domain !== 'thinkbridge.com' && domain !== 'thinkbridge.in') {
      return res.status(403).json({
        success: false,
        message: 'Organization features only available for @thinkbridge.com and @thinkbridge.in users',
      });
    }

    const days = parseInt(req.query.days as string) || 30;
    // Use primary domain for organization lookup
    const org = await Organization.findOne({ domain: 'thinkbridge.com' });

    if (!org || !org.scoreHistory || org.scoreHistory.length === 0) {
      return res.json({
        success: true,
        history: [],
      });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const history = org.scoreHistory
      .filter(h => new Date(h.date) >= cutoffDate)
      .map(h => ({
        date: new Date(h.date).toISOString().split('T')[0],
        score: h.score,
        members: org.totalMembers,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      history,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching score history',
    });
  }
});

export default router;

