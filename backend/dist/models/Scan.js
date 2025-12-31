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
const ScanSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    userEmail: {
        type: String,
        required: true,
    },
    deviceId: {
        type: String,
        required: true,
    },
    scanTimestamp: {
        type: Date,
        required: true,
    },
    scanType: {
        type: String,
        enum: ['quick', 'full', 'health'],
        default: 'quick',
    },
    isScheduled: {
        type: Boolean,
        default: false,
    },
    scheduledScanId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ScheduledScan',
    },
    systemInfo: {
        computerName: String,
        osName: String,
        osVersion: String,
        osBuild: String,
        architecture: String,
        manufacturer: String,
        model: String,
    },
    software: [{
            name: String,
            version: String,
            publisher: String,
            installDate: String,
        }],
    browserExtensions: [{
            browser: String,
            name: String,
            version: String,
            extensionId: String,
        }],
    patches: {
        totalPatches: Number,
        latestPatchId: String,
        latestPatchDate: Date,
    },
    vulnerabilities: {
        total: Number,
        critical: Number,
        high: Number,
        medium: Number,
        low: Number,
        exploitable: Number,
        items: [{
                software: String,
                version: String,
                cveId: String,
                cvssScore: Number,
                severity: {
                    type: String,
                    enum: ['critical', 'high', 'medium', 'low'],
                },
                description: String,
                exploitable: Boolean,
                recommendation: String,
                affectedEndpoints: [String],
            }],
    },
    secureScore: Number,
    endpointExposureScore: Number,
    status: {
        type: String,
        enum: ['pending', 'running', 'analyzing', 'completed', 'failed'],
        default: 'pending',
    },
    errorMessage: String,
    createdAt: {
        type: Date,
        default: Date.now,
    },
    analyzedAt: Date,
});
ScanSchema.index({ userId: 1, scanTimestamp: -1 });
ScanSchema.index({ deviceId: 1, scanTimestamp: -1 });
exports.default = mongoose_1.default.model('Scan', ScanSchema);
