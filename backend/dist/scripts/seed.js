"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const User_1 = __importDefault(require("../models/User"));
const Scan_1 = __importDefault(require("../models/Scan"));
const Organization_1 = __importDefault(require("../models/Organization"));
const apiKeyGenerator_1 = require("../utils/apiKeyGenerator");
const vulnerabilityAnalyzer_1 = require("../utils/vulnerabilityAnalyzer");
const scoreCalculator_1 = require("../utils/scoreCalculator");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../app.env') });
const MOCK_SOFTWARE = [
    { name: 'Google Chrome', version: '118.0.5993.89', publisher: 'Google LLC', installDate: '20240101' },
    { name: 'Mozilla Firefox', version: '119.0', publisher: 'Mozilla Foundation', installDate: '20240105' },
    { name: 'Node.js', version: '18.17.0', publisher: 'Node.js Foundation', installDate: '20231215' },
    { name: 'Express', version: '4.17.1', publisher: 'Express.js', installDate: '20231220' },
    { name: 'Visual Studio Code', version: '1.85.0', publisher: 'Microsoft Corporation', installDate: '20240110' },
    { name: 'Python', version: '3.11.5', publisher: 'Python Software Foundation', installDate: '20231201' },
    { name: 'Git', version: '2.42.0', publisher: 'Git Developers', installDate: '20231120' },
    { name: 'Docker Desktop', version: '4.25.0', publisher: 'Docker Inc.', installDate: '20240108' },
];
async function seed() {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thinkathon');
        console.log('Connected to MongoDB');
        // Clear existing data
        await User_1.default.deleteMany({});
        await Scan_1.default.deleteMany({});
        await Organization_1.default.deleteMany({});
        console.log('Cleared existing data');
        // Create demo users
        const password = await bcrypt_1.default.hash('demo123', 10);
        const user1 = new User_1.default({
            email: 'demo@test.com',
            password,
            firstName: 'Demo',
            lastName: 'User',
            organization: 'Test Org',
            apiKey: (0, apiKeyGenerator_1.generateApiKey)('demo@test.com'),
            role: 'user',
        });
        await user1.save();
        const user2 = new User_1.default({
            email: 'john@thinkbridge.com',
            password,
            firstName: 'John',
            lastName: 'Doe',
            organization: 'ThinkBridge',
            apiKey: (0, apiKeyGenerator_1.generateApiKey)('john@thinkbridge.com'),
            role: 'user',
        });
        await user2.save();
        const user3 = new User_1.default({
            email: 'sarah@thinkbridge.com',
            password,
            firstName: 'Sarah',
            lastName: 'Smith',
            organization: 'ThinkBridge',
            apiKey: (0, apiKeyGenerator_1.generateApiKey)('sarah@thinkbridge.com'),
            role: 'user',
        });
        await user3.save();
        console.log('Created demo users');
        // Create sample scans
        const users = [user1, user2, user3];
        const deviceIds = ['DEVICE-001', 'DEVICE-002', 'DEVICE-003'];
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const deviceId = deviceIds[i];
            // Create 3-5 scans per user with varying dates
            const scanCount = 3 + Math.floor(Math.random() * 3);
            for (let j = 0; j < scanCount; j++) {
                const scanDate = new Date();
                scanDate.setDate(scanDate.getDate() - (j * 7 + Math.floor(Math.random() * 3)));
                const scan = new Scan_1.default({
                    userId: user._id,
                    userEmail: user.email,
                    deviceId,
                    scanTimestamp: scanDate,
                    systemInfo: {
                        computerName: `PC-${deviceId}`,
                        osName: 'Microsoft Windows 11',
                        osVersion: '10.0.22621',
                        osBuild: '22621',
                        architecture: '64-bit',
                        manufacturer: 'Dell Inc.',
                        model: 'OptiPlex 7090',
                    },
                    software: MOCK_SOFTWARE.slice(0, 5 + Math.floor(Math.random() * 3)),
                    browserExtensions: [
                        {
                            browser: 'Chrome',
                            name: 'AdBlock',
                            version: '5.0.0',
                            extensionId: 'ext-001',
                        },
                        {
                            browser: 'Chrome',
                            name: 'LastPass',
                            version: '4.100.0',
                            extensionId: 'ext-002',
                        },
                    ],
                    patches: {
                        totalPatches: 45 + Math.floor(Math.random() * 20),
                        latestPatchId: `KB${500000 + Math.floor(Math.random() * 1000)}`,
                        latestPatchDate: new Date(scanDate.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
                    },
                    status: 'completed',
                });
                // Analyze vulnerabilities
                scan.vulnerabilities = (0, vulnerabilityAnalyzer_1.analyzeVulnerabilities)(scan);
                scan.endpointExposureScore = (0, scoreCalculator_1.calculateEndpointExposureScore)(scan);
                // Calculate secure score
                const userScans = await Scan_1.default.find({ userId: user._id });
                scan.secureScore = (0, scoreCalculator_1.calculateUserSecureScore)([...userScans, scan], user);
                scan.analyzedAt = new Date(scanDate.getTime() + 2000);
                await scan.save();
            }
        }
        console.log('Created sample scans');
        // Create organization record
        const orgUsers = await User_1.default.find({ email: { $regex: /@thinkbridge\.com$/ } });
        const orgScans = await Scan_1.default.find({
            userId: { $in: orgUsers.map(u => u._id) },
        });
        const orgScores = [];
        for (const orgUser of orgUsers) {
            const userScans = await Scan_1.default.find({ userId: orgUser._id })
                .sort({ scanTimestamp: -1 })
                .limit(10);
            if (userScans.length > 0) {
                orgScores.push((0, scoreCalculator_1.calculateUserSecureScore)(userScans, orgUser));
            }
        }
        const orgScore = orgScores.length > 0
            ? Math.round(orgScores.reduce((a, b) => a + b, 0) / orgScores.length)
            : 0;
        const uniqueDevices = new Set(orgScans.map(s => s.deviceId)).size;
        await Organization_1.default.create({
            domain: 'thinkbridge.com',
            name: 'ThinkBridge',
            secureScore: orgScore,
            totalMembers: orgUsers.length,
            totalDevices: uniqueDevices,
            scoreHistory: [
                { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), score: orgScore - 5 },
                { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), score: orgScore - 2 },
                { date: new Date(), score: orgScore },
            ],
        });
        console.log('Created organization record');
        console.log('\n✅ Seed data created successfully!');
        console.log('\nDemo users:');
        console.log('  - demo@test.com / demo123');
        console.log('  - john@thinkbridge.com / demo123');
        console.log('  - sarah@thinkbridge.com / demo123');
        await mongoose_1.default.disconnect();
    }
    catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}
seed();
