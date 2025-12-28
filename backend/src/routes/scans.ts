import express, { Response } from 'express';
import Scan from '../models/Scan';
import { authenticateToken, authenticateApiKey, AuthRequest } from '../middleware/auth';
import { analyzeVulnerabilities } from '../utils/vulnerabilityAnalyzer';
import { calculateUserSecureScore, calculateEndpointExposureScore } from '../utils/scoreCalculator';
import User from '../models/User';

const router = express.Router();

// Submit scan (from PowerShell script)
router.post('/submit', authenticateApiKey, async (req: AuthRequest, res: Response) => {
  try {
    const {
      deviceId,
      scanTimestamp,
      systemInfo,
      software,
      browserExtensions,
      patches,
    } = req.body;

    if (!deviceId || !scanTimestamp || !systemInfo || !software) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Create scan with pending status
    const scan = new Scan({
      userId: req.userId,
      userEmail: req.user.email,
      deviceId,
      scanTimestamp: new Date(scanTimestamp),
      systemInfo,
      software,
      browserExtensions: browserExtensions || [],
      patches: {
        totalPatches: patches?.totalPatches || 0,
        latestPatchId: patches?.latestPatchId || '',
        latestPatchDate: patches?.latestPatchDate ? new Date(patches.latestPatchDate) : new Date(),
      },
      status: 'analyzing',
    });

    await scan.save();

    // Analyze vulnerabilities asynchronously
    setTimeout(async () => {
      try {
        const vulnerabilities = analyzeVulnerabilities(scan);
        const endpointExposureScore = calculateEndpointExposureScore({
          ...scan.toObject(),
          vulnerabilities,
        } as any);

        const user = await User.findById(req.userId);
        const userScans = await Scan.find({ userId: req.userId });
        const secureScore = calculateUserSecureScore(userScans, user!);

        scan.vulnerabilities = vulnerabilities;
        scan.endpointExposureScore = endpointExposureScore;
        scan.secureScore = secureScore;
        scan.status = 'completed';
        scan.analyzedAt = new Date();

        await scan.save();
      } catch (error) {
        console.error('Error analyzing scan:', error);
        scan.status = 'completed';
        await scan.save();
      }
    }, 2000); // Simulate analysis delay

    res.json({
      success: true,
      scanId: scan._id,
      message: 'Scan submitted successfully. Analysis in progress.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error submitting scan',
    });
  }
});

// Get all scans
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const deviceId = req.query.deviceId as string;

    const query: any = { userId: req.userId };
    if (deviceId) {
      query.deviceId = deviceId;
    }

    const scans = await Scan.find(query)
      .sort({ scanTimestamp: -1 })
      .limit(limit)
      .lean();

    const totalScans = await Scan.countDocuments(query);

    res.json({
      success: true,
      scans,
      totalScans,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching scans',
    });
  }
});

// Get scan by ID
router.get('/:scanId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const scan = await Scan.findOne({
      _id: req.params.scanId,
      userId: req.userId,
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found',
      });
    }

    res.json({
      success: true,
      scan,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching scan',
    });
  }
});

export default router;

