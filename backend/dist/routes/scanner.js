"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const User_1 = __importDefault(require("../models/User"));
const apiKeyGenerator_1 = require("../utils/apiKeyGenerator");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Generate personalized scanner script
router.post('/generate', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        // Generate API key if not exists
        if (!user.apiKey) {
            user.apiKey = (0, apiKeyGenerator_1.generateApiKey)(user.email);
            await user.save();
        }
        // Read template
        const templatePath = path_1.default.join(__dirname, '../../templates/scanner_template.ps1');
        let template = fs_1.default.readFileSync(templatePath, 'utf-8');
        // Replace placeholders
        const apiEndpoint = `${process.env.API_BASE_URL}/api/scan/submit`;
        template = template
            .replace(/{{USER_EMAIL}}/g, user.email)
            .replace(/{{API_ENDPOINT}}/g, apiEndpoint)
            .replace(/{{API_KEY}}/g, user.apiKey);
        // Set headers for file download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="scanner.ps1"');
        res.send(template);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error generating scanner',
        });
    }
});
// Get API credentials
router.get('/credentials', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        // Generate API key if not exists
        if (!user.apiKey) {
            user.apiKey = (0, apiKeyGenerator_1.generateApiKey)(user.email);
            await user.save();
        }
        res.json({
            success: true,
            apiKey: user.apiKey,
            apiEndpoint: `${process.env.API_BASE_URL}/api/scan/submit`,
            userEmail: user.email,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching credentials',
        });
    }
});
exports.default = router;
