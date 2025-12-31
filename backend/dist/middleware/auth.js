"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateApiKey = exports.optionalAuth = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            console.log('No token provided in request');
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET not configured');
            return res.status(500).json({ success: false, message: 'Server configuration error' });
        }
        console.log('Verifying JWT token...');
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        console.log('Finding user by ID:', decoded.userId);
        const user = await User_1.default.findById(decoded.userId).select('-password');
        if (!user) {
            console.log('User not found for token:', decoded.userId);
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        req.user = user;
        req.userId = user._id.toString();
        console.log('Authentication successful for user:', user.email);
        next();
    }
    catch (error) {
        console.error('Token authentication error:', error.message);
        return res.status(403).json({
            success: false,
            message: 'Invalid token',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.authenticateToken = authenticateToken;
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token || !process.env.JWT_SECRET) {
            // No token provided or JWT secret not configured - continue without auth
            console.log('No authentication provided, continuing as guest');
            next();
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const user = await User_1.default.findById(decoded.userId).select('-password');
            if (user) {
                req.user = user;
                req.userId = user._id.toString();
                console.log('Optional authentication successful for user:', user.email);
            }
        }
        catch (error) {
            // Invalid token - continue without auth
            console.log('Invalid token provided, continuing as guest');
        }
        next();
    }
    catch (error) {
        console.error('Optional auth error:', error.message);
        next(); // Continue even if there's an error
    }
};
exports.optionalAuth = optionalAuth;
const authenticateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers.authorization?.replace('Bearer ', '') ||
            req.headers['x-api-key'];
        const userEmail = req.headers['x-user-email'];
        if (!apiKey || !userEmail) {
            return res.status(401).json({
                success: false,
                message: 'API key and user email required'
            });
        }
        const user = await User_1.default.findOne({
            apiKey,
            email: userEmail.toLowerCase()
        });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid API credentials' });
        }
        req.user = user;
        req.userId = user._id.toString();
        next();
    }
    catch (error) {
        return res.status(403).json({ success: false, message: 'Authentication failed' });
    }
};
exports.authenticateApiKey = authenticateApiKey;
