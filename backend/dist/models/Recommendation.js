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
const RecommendationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    recommendationId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    action: { type: String, required: true },
    whyItMatters: { type: String, required: true },
    expectedRiskReduction: { type: Number, required: true, min: 1, max: 50 },
    priority: { type: String, enum: ['high', 'medium', 'low'], required: true },
    category: { type: String, enum: ['endpoint', 'system', 'network', 'application'], required: true },
    userActionable: { type: Boolean, default: true },
    estimatedTimeMinutes: { type: Number, required: true, min: 1, max: 60 },
    status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7 days
    scanId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Scan' },
    softwareName: { type: String },
    vulnerabilityIds: [{ type: String }],
});
// Index for efficient queries
RecommendationSchema.index({ userId: 1, deviceId: 1, status: 1 });
RecommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired recommendations
// Update the updatedAt field on save
RecommendationSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
exports.default = mongoose_1.default.model('Recommendation', RecommendationSchema);
