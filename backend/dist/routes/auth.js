"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../middleware/auth");
const apiKeyGenerator_1 = require("../utils/apiKeyGenerator");
const router = express_1.default.Router();
// Signup
router.post('/signup', async (req, res) => {
    try {
        console.log('Signup attempt:', { email: req.body.email, hasPassword: !!req.body.password });
        const { email, password, firstName, lastName } = req.body;
        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('Invalid email format:', email);
            return res.status(400).json({
                success: false,
                message: 'Invalid email format',
            });
        }
        // Check if user exists
        console.log('Checking if user exists...');
        const existingUser = await User_1.default.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('User already exists:', email);
            return res.status(400).json({
                success: false,
                message: 'User already exists',
            });
        }
        // Hash password
        console.log('Hashing password...');
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // Extract domain for organization detection
        const emailParts = email.toLowerCase().split('@');
        const domain = emailParts.length === 2 ? emailParts[1] : '';
        // Auto-detect organization for thinkbridge domains
        let organization = '';
        if (domain === 'thinkbridge.com' || domain === 'thinkbridge.in') {
            organization = 'ThinkBridge';
        }
        // Create user
        console.log('Creating user...');
        const user = new User_1.default({
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName: firstName || '',
            lastName: lastName || '',
            organization,
            apiKey: (0, apiKeyGenerator_1.generateApiKey)(email.toLowerCase()),
        });
        console.log('Saving user to database...');
        await user.save();
        console.log('User saved successfully with API key');
        // Generate token
        console.log('Generating JWT token...');
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET not configured');
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        // Remove password from response
        const { password: _, ...userObj } = user.toObject();
        console.log('Signup successful for:', email);
        res.status(201).json({
            success: true,
            token,
            user: userObj,
        });
    }
    catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating user',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
        const { email, password } = req.body;
        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }
        // Find user
        console.log('Finding user...');
        const user = await User_1.default.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        // Check password
        console.log('Checking password...');
        const isValid = await bcrypt_1.default.compare(password, user.password);
        if (!isValid) {
            console.log('Invalid password for user:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        // Update last login and generate API key if missing
        console.log('Updating last login...');
        user.lastLogin = new Date();
        // Generate API key if doesn't exist
        if (!user.apiKey) {
            console.log('Generating API key for existing user...');
            user.apiKey = (0, apiKeyGenerator_1.generateApiKey)(user.email);
        }
        await user.save();
        // Generate token
        console.log('Generating JWT token...');
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET not configured');
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        // Remove password from response
        const { password: _, ...userObj } = user.toObject();
        console.log('Login successful for:', email);
        res.json({
            success: true,
            token,
            user: userObj,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error logging in',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
});
// Get current user
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.userId).select('-password');
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching user',
        });
    }
});
exports.default = router;
