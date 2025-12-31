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
const ThreatCorrelationSchema = new mongoose_1.Schema({
    cveId: {
        type: String,
        required: true,
        index: true,
        uppercase: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    userEmail: {
        type: String,
        required: true,
        index: true
    },
    impactedEndpoints: [{
            type: String,
            required: true
        }],
    impactedSoftware: [{
            name: { type: String, required: true },
            version: { type: String, required: true },
            endpoints: [{ type: String, required: true }]
        }],
    riskScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        index: true
    },
    riskFactors: {
        cvssScore: { type: Number, required: true },
        exploitedMultiplier: { type: Number, default: 1 },
        endpointCount: { type: Number, required: true },
        internetExposure: { type: Boolean, default: false },
        criticalSystem: { type: Boolean, default: false }
    },
    lastChecked: {
        type: Date,
        default: Date.now,
        index: true
    },
    threatDetails: {
        severity: {
            type: String,
            enum: ['critical', 'high', 'medium', 'low'],
            required: true
        },
        exploited: { type: Boolean, required: true },
        cisaKev: { type: Boolean, default: false },
        exploitAvailable: { type: Boolean, default: false }
    },
    actionRecommendations: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Compound indexes for efficient queries
ThreatCorrelationSchema.index({ userId: 1, riskScore: -1 });
ThreatCorrelationSchema.index({ userId: 1, cveId: 1 }, { unique: true });
ThreatCorrelationSchema.index({ userId: 1, 'threatDetails.severity': 1 });
ThreatCorrelationSchema.index({ userId: 1, 'threatDetails.exploited': 1 });
ThreatCorrelationSchema.index({ riskScore: -1, lastChecked: -1 });
// Update timestamp on save
ThreatCorrelationSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
// Static method to calculate risk score
ThreatCorrelationSchema.statics.calculateRiskScore = function (factors) {
    const { cvssScore, exploitedMultiplier = 1, endpointCount, internetExposure = false, criticalSystem = false } = factors;
    // Base score from CVSS (0-100)
    let riskScore = (cvssScore / 10) * 100;
    // Apply exploited multiplier (KEV = 2x, exploit available = 1.5x)
    riskScore *= exploitedMultiplier;
    // Endpoint count factor (more endpoints = higher risk)
    const endpointFactor = Math.min(1 + (endpointCount - 1) * 0.1, 2);
    riskScore *= endpointFactor;
    // Internet exposure adds significant risk
    if (internetExposure) {
        riskScore *= 1.3;
    }
    // Critical system designation
    if (criticalSystem) {
        riskScore *= 1.2;
    }
    // Cap at 100
    return Math.min(Math.round(riskScore), 100);
};
exports.default = mongoose_1.default.model('ThreatCorrelation', ThreatCorrelationSchema);
