import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';
import Scan from '../models/Scan';
import Organization from '../models/Organization';
import { generateApiKey } from '../utils/apiKeyGenerator';
import { analyzeVulnerabilities } from '../utils/vulnerabilityAnalyzer';
import { calculateUserSecureScore, calculateEndpointExposureScore } from '../utils/scoreCalculator';

dotenv.config({ path: path.join(__dirname, '../../app.env') });

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
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thinkathon');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Scan.deleteMany({});
    await Organization.deleteMany({});
    console.log('Cleared existing data');

    // Create demo users
    const password = await bcrypt.hash('demo123', 10);
    
    const user1 = new User({
      email: 'demo@test.com',
      password,
      firstName: 'Demo',
      lastName: 'User',
      organization: 'Test Org',
      apiKey: generateApiKey('demo@test.com'),
      role: 'user',
    });
    await user1.save();

    const user2 = new User({
      email: 'john@thinkbridge.com',
      password,
      firstName: 'John',
      lastName: 'Doe',
      organization: 'ThinkBridge',
      apiKey: generateApiKey('john@thinkbridge.com'),
      role: 'user',
    });
    await user2.save();

    const user3 = new User({
      email: 'sarah@thinkbridge.com',
      password,
      firstName: 'Sarah',
      lastName: 'Smith',
      organization: 'ThinkBridge',
      apiKey: generateApiKey('sarah@thinkbridge.com'),
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

        const scan = new Scan({
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
        scan.vulnerabilities = analyzeVulnerabilities(scan);
        scan.endpointExposureScore = calculateEndpointExposureScore(scan as any);
        
        // Calculate secure score
        const userScans = await Scan.find({ userId: user._id });
        scan.secureScore = calculateUserSecureScore([...userScans, scan] as any, user);
        scan.analyzedAt = new Date(scanDate.getTime() + 2000);

        await scan.save();
      }
    }

    console.log('Created sample scans');

    // Create organization record
    const orgUsers = await User.find({ email: { $regex: /@thinkbridge\.com$/ } });
    const orgScans = await Scan.find({
      userId: { $in: orgUsers.map(u => u._id) },
    });

    const orgScores = [];
    for (const orgUser of orgUsers) {
      const userScans = await Scan.find({ userId: orgUser._id })
        .sort({ scanTimestamp: -1 })
        .limit(10);
      if (userScans.length > 0) {
        orgScores.push(calculateUserSecureScore(userScans as any, orgUser));
      }
    }

    const orgScore = orgScores.length > 0
      ? Math.round(orgScores.reduce((a, b) => a + b, 0) / orgScores.length)
      : 0;

    const uniqueDevices = new Set(orgScans.map(s => s.deviceId)).size;

    await Organization.create({
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

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();

