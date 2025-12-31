"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const Scan_1 = __importDefault(require("../models/Scan"));
const User_1 = __importDefault(require("../models/User"));
const Recommendation_1 = __importDefault(require("../models/Recommendation"));
const llmService_1 = __importDefault(require("../services/llmService"));
const router = express_1.default.Router();
// Microsoft Defender recommendations (filtered for user-actionable only)
const USER_ACTIONABLE_DEFENDER_RECOMMENDATIONS = [
    {
        id: 'turn_on_defender_antivirus',
        title: 'Turn on Microsoft Defender Antivirus',
        category: 'endpoint',
        description: 'Enable real-time antivirus protection',
        userActionable: true
    },
    {
        id: 'enable_real_time_protection',
        title: 'Turn on real-time protection',
        category: 'endpoint',
        description: 'Enable continuous malware scanning',
        userActionable: true
    },
    {
        id: 'turn_on_defender_firewall',
        title: 'Turn on Microsoft Defender Firewall',
        category: 'network',
        description: 'Enable network protection',
        userActionable: true
    },
    {
        id: 'update_defender_definitions',
        title: 'Update Microsoft Defender Antivirus definitions',
        category: 'endpoint',
        description: 'Keep virus definitions current',
        userActionable: true
    },
    {
        id: 'enable_cloud_protection',
        title: 'Enable cloud-delivered protection',
        category: 'endpoint',
        description: 'Use cloud-based threat detection',
        userActionable: true
    },
    {
        id: 'enable_smartscreen',
        title: 'Set Microsoft Defender SmartScreen to block or warn',
        category: 'application',
        description: 'Protect against malicious websites and downloads',
        userActionable: true
    },
    {
        id: 'enable_uac',
        title: 'Set User Account Control (UAC) properly',
        category: 'system',
        description: 'Require permission for system changes',
        userActionable: true
    },
    {
        id: 'disable_autorun',
        title: 'Set default behavior for AutoRun to disabled',
        category: 'system',
        description: 'Prevent automatic execution from removable drives',
        userActionable: true
    },
    {
        id: 'enable_automatic_updates',
        title: 'Enable Automatic Updates',
        category: 'system',
        description: 'Keep Windows updated automatically',
        userActionable: true
    },
    {
        id: 'secure_browser_settings',
        title: 'Block third party cookies',
        category: 'application',
        description: 'Improve browser privacy and security',
        userActionable: true
    },
    {
        id: 'disable_guest_account',
        title: 'Disable the built-in Guest account',
        category: 'system',
        description: 'Remove unnecessary access points',
        userActionable: true
    },
    {
        id: 'enable_bitlocker',
        title: 'Resume BitLocker protection on all drives',
        category: 'system',
        description: 'Encrypt your hard drives for data protection',
        userActionable: true
    },
    {
        id: 'disable_smb_v1',
        title: 'Disable SMBv1 client driver',
        category: 'network',
        description: 'Remove outdated network protocol',
        userActionable: true
    },
    {
        id: 'enable_dep',
        title: 'Enable Explorer Data Execution Prevention (DEP)',
        category: 'system',
        description: 'Prevent malicious code execution',
        userActionable: true
    },
    {
        id: 'secure_rdp',
        title: 'Set Remote Desktop security level to TLS',
        category: 'network',
        description: 'Secure remote connections',
        userActionable: true
    }
];
// Get AI-generated recommendations
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Get latest scan data
        const latestScans = await Scan_1.default.find({ userId: req.userId })
            .sort({ scanTimestamp: -1 })
            .limit(5);
        if (latestScans.length === 0) {
            return res.json({
                success: true,
                recommendations: [],
                message: 'No scan data available. Please run a security scan first.'
            });
        }
        // Prepare inventory data for LLM
        const latestScan = latestScans[0];
        const inventory = {
            userId: req.userId,
            userEmail: user.email,
            deviceId: latestScan.deviceId,
            scanId: latestScan._id.toString(),
            software: latestScan.software || [],
            systemInfo: latestScan.systemInfo || {},
            secureScore: latestScan.secureScore || 50,
            totalVulnerabilities: latestScan.vulnerabilities?.total || 0,
            criticalVulnerabilities: latestScan.vulnerabilities?.critical || 0
        };
        // Generate AI recommendations
        const aiRecommendations = await llmService_1.default.generateRecommendations(inventory);
        // Combine with filtered Defender recommendations
        const defenderRecommendations = USER_ACTIONABLE_DEFENDER_RECOMMENDATIONS
            .slice(0, 3) // Limit to top 3
            .map(rec => ({
            ...rec,
            action: getDefenderActionSteps(rec.id),
            whyItMatters: getDefenderWhyItMatters(rec.id),
            expectedRiskReduction: getDefenderRiskReduction(rec.id),
            priority: getDefenderPriority(rec.id),
            estimatedTimeMinutes: getDefenderTimeEstimate(rec.id),
            status: 'not_started'
        }));
        const allRecommendations = [...aiRecommendations, ...defenderRecommendations];
        // Get score explanation
        const scoreExplanation = await llmService_1.default.explainSecurityScore({
            software: latestScan.software || [],
            systemInfo: latestScan.systemInfo || {},
            secureScore: latestScan.secureScore || 50,
            totalVulnerabilities: latestScan.vulnerabilities?.total || 0,
            criticalVulnerabilities: latestScan.vulnerabilities?.critical || 0
        });
        res.json({
            success: true,
            recommendations: allRecommendations,
            scoreExplanation,
            totalRecommendations: allRecommendations.length,
            highPriority: allRecommendations.filter(r => r.priority === 'high').length
        });
    }
    catch (error) {
        console.error('Error generating recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate recommendations'
        });
    }
});
// Update recommendation status
router.put('/:recommendationId/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const { recommendationId } = req.params;
        if (!['not_started', 'in_progress', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: not_started, in_progress, or completed'
            });
        }
        // Update recommendation status directly
        const recommendation = await Recommendation_1.default.findOneAndUpdate({
            userId: req.userId,
            recommendationId: recommendationId
        }, {
            status: status,
            updatedAt: new Date()
        }, { new: true });
        if (!recommendation) {
            return res.status(404).json({
                success: false,
                message: 'Recommendation not found'
            });
        }
        res.json({
            success: true,
            message: 'Recommendation status updated successfully',
            recommendationId,
            status
        });
    }
    catch (error) {
        console.error('Error updating recommendation status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update recommendation status'
        });
    }
});
// Helper functions for Defender recommendations
function getDefenderActionSteps(id) {
    const actions = {
        turn_on_defender_antivirus: 'Open Windows Security > Virus & threat protection > Turn on Real-time protection',
        enable_real_time_protection: 'Go to Windows Security > Virus & threat protection > Manage settings > Turn on Real-time protection',
        turn_on_defender_firewall: 'Open Windows Security > Firewall & network protection > Turn on firewall for all networks',
        update_defender_definitions: 'Open Windows Security > Virus & threat protection > Check for updates',
        enable_cloud_protection: 'Windows Security > Virus & threat protection > Manage settings > Turn on Cloud-delivered protection',
        enable_smartscreen: 'Windows Security > App & browser control > Turn on SmartScreen for Microsoft Edge',
        enable_uac: 'Control Panel > User Accounts > Change User Account Control settings > Set to "Notify me only when apps try to make changes"',
        disable_autorun: 'Group Policy Editor > Computer Configuration > Administrative Templates > Windows Components > AutoPlay Policies > Turn off Autoplay',
        enable_automatic_updates: 'Settings > Update & Security > Windows Update > Advanced options > Turn on automatic updates',
        secure_browser_settings: 'Open your browser settings > Privacy and security > Block third-party cookies',
        disable_guest_account: 'Computer Management > Local Users and Groups > Users > Right-click Guest > Properties > Check "Account is disabled"',
        enable_bitlocker: 'Control Panel > BitLocker Drive Encryption > Turn on BitLocker for each drive',
        disable_smb_v1: 'Control Panel > Programs > Turn Windows features on or off > Uncheck SMB 1.0/CIFS File Sharing Support',
        enable_dep: 'System Properties > Advanced > Performance Settings > Data Execution Prevention > Turn on DEP for all programs',
        secure_rdp: 'System Properties > Remote > Check "Enable Network Level Authentication"'
    };
    return actions[id] || 'Follow Windows security best practices';
}
function getDefenderWhyItMatters(id) {
    const explanations = {
        turn_on_defender_antivirus: 'Antivirus protection blocks malware and viruses from infecting your computer',
        enable_real_time_protection: 'Real-time scanning catches threats as they try to enter your system',
        turn_on_defender_firewall: 'Firewall blocks unauthorized network access and prevents hackers from reaching your computer',
        update_defender_definitions: 'Updated virus definitions help detect the latest malware threats',
        enable_cloud_protection: 'Cloud protection provides faster detection of new and emerging threats',
        enable_smartscreen: 'SmartScreen warns you about malicious websites and dangerous downloads',
        enable_uac: 'UAC prevents unauthorized programs from making changes to your system',
        disable_autorun: 'Prevents malware from automatically running when you insert USB drives or CDs',
        enable_automatic_updates: 'Automatic updates ensure you get critical security patches as soon as they\'re available',
        secure_browser_settings: 'Blocking third-party cookies improves privacy and reduces tracking',
        disable_guest_account: 'Guest accounts provide unnecessary access points that attackers could exploit',
        enable_bitlocker: 'BitLocker encrypts your data so it can\'t be accessed if your device is stolen',
        disable_smb_v1: 'SMBv1 is an outdated protocol with known security vulnerabilities',
        enable_dep: 'DEP prevents malicious code from executing in memory areas it shouldn\'t access',
        secure_rdp: 'Network Level Authentication adds an extra security layer to remote connections'
    };
    return explanations[id] || 'This improves your overall security posture';
}
function getDefenderRiskReduction(id) {
    const reductions = {
        turn_on_defender_antivirus: 30,
        enable_real_time_protection: 25,
        turn_on_defender_firewall: 20,
        update_defender_definitions: 15,
        enable_cloud_protection: 18,
        enable_smartscreen: 22,
        enable_uac: 15,
        disable_autorun: 12,
        enable_automatic_updates: 35,
        secure_browser_settings: 8,
        disable_guest_account: 10,
        enable_bitlocker: 25,
        disable_smb_v1: 15,
        enable_dep: 12,
        secure_rdp: 18
    };
    return reductions[id] || 10;
}
function getDefenderPriority(id) {
    const priorities = {
        turn_on_defender_antivirus: 'high',
        enable_real_time_protection: 'high',
        turn_on_defender_firewall: 'high',
        update_defender_definitions: 'medium',
        enable_cloud_protection: 'medium',
        enable_smartscreen: 'high',
        enable_uac: 'medium',
        disable_autorun: 'medium',
        enable_automatic_updates: 'high',
        secure_browser_settings: 'low',
        disable_guest_account: 'medium',
        enable_bitlocker: 'high',
        disable_smb_v1: 'medium',
        enable_dep: 'medium',
        secure_rdp: 'medium'
    };
    return priorities[id] || 'medium';
}
function getDefenderTimeEstimate(id) {
    const times = {
        turn_on_defender_antivirus: 3,
        enable_real_time_protection: 2,
        turn_on_defender_firewall: 5,
        update_defender_definitions: 5,
        enable_cloud_protection: 3,
        enable_smartscreen: 4,
        enable_uac: 5,
        disable_autorun: 10,
        enable_automatic_updates: 5,
        secure_browser_settings: 3,
        disable_guest_account: 8,
        enable_bitlocker: 15,
        disable_smb_v1: 10,
        enable_dep: 8,
        secure_rdp: 7
    };
    return times[id] || 5;
}
exports.default = router;
