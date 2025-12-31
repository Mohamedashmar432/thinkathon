"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const ScheduledScanSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    scanType: { type: String, enum: ['quick', 'health'], required: true },
    enabled: { type: Boolean, default: true },
    scheduledTimeIST: { type: String, required: true, default: '05:00' },
    scheduledTimeUTC: { type: String, required: true, default: '23:30' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    lastRun: { type: Date },
    nextRun: { type: Date, required: true, index: true },
    missedRuns: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
// Compound index for efficient queries
ScheduledScanSchema.index({ userId: 1, deviceId: 1, scanType: 1 }, { unique: true });
ScheduledScanSchema.index({ enabled: 1, nextRun: 1 }); // For scheduler queries
// Update the updatedAt field on save
ScheduledScanSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
// Helper method to calculate next run time
ScheduledScanSchema.methods.calculateNextRun = function () {
    const now = new Date();
    const [hours, minutes] = this.scheduledTimeUTC.split(':').map(Number);
    // Create next run date in UTC
    const nextRun = new Date();
    nextRun.setUTCHours(hours, minutes, 0, 0);
    // If the time has already passed today, schedule for tomorrow
    if (nextRun <= now) {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
    this.nextRun = nextRun;
    return nextRun;
};
// Helper method to convert IST to UTC
ScheduledScanSchema.statics.convertISTToUTC = function (istTime) {
    const [hours, minutes] = istTime.split(':').map(Number);
    // IST is UTC+5:30, so subtract 5 hours and 30 minutes
    let utcHours = hours - 5;
    let utcMinutes = minutes - 30;
    // Handle minute underflow
    if (utcMinutes < 0) {
        utcMinutes += 60;
        utcHours -= 1;
    }
    // Handle hour underflow (previous day)
    if (utcHours < 0) {
        utcHours += 24;
    }
    return `${utcHours.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}`;
};
exports.default = mongoose_1.default.model('ScheduledScan', ScheduledScanSchema);
