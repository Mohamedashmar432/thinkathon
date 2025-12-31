"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = __importDefault(require("../models/User"));
const Scan_1 = __importDefault(require("../models/Scan"));
const Organization_1 = __importDefault(require("../models/Organization"));
const auth_1 = require("../middleware/auth");
const scoreCalculator_1 = require("../utils/scoreCalculator");
const router = express_1.default.Router();
// Get organization score
router.get('/score', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.userId);
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
        const orgUsers = await User_1.default.find({
            $or: [
                { email: { $regex: /@thinkbridge\.com$/ } },
                { email: { $regex: /@thinkbridge\.in$/ } },
            ],
        });
        // Calculate scores for all users
        const userScores = [];
        for (const orgUser of orgUsers) {
            const scans = await Scan_1.default.find({ userId: orgUser._id })
                .sort({ scanTimestamp: -1 })
                .limit(10);
            if (scans.length > 0) {
                const score = (0, scoreCalculator_1.calculateUserSecureScore)(scans, orgUser);
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
        const organizationScore = Math.round(userScores.reduce((sum, u) => sum + u.score, 0) / userScores.length);
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
        const allScans = await Scan_1.default.find({
            userId: { $in: orgUsers.map(u => u._id) },
        });
        const uniqueDevices = new Set(allScans.map(s => s.deviceId)).size;
        // Update organization record (use 'thinkbridge.com' as primary domain)
        const primaryDomain = 'thinkbridge.com';
        await Organization_1.default.findOneAndUpdate({ domain: primaryDomain }, {
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
        }, { upsert: true, new: true });
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching organization score',
        });
    }
});
// Get organization score history
router.get('/score-history', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.userId);
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
        const days = parseInt(req.query.days) || 30;
        // Use primary domain for organization lookup
        const org = await Organization_1.default.findOne({ domain: 'thinkbridge.com' });
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching score history',
        });
    }
});
exports.default = router;
