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
const SystemLogSchema = new mongoose_1.Schema({
    timestamp: { type: Date, default: Date.now, index: true },
    level: {
        type: String,
        enum: ['error', 'warn', 'info', 'debug'],
        required: true,
        index: true
    },
    component: {
        type: String,
        enum: ['agent', 'scan', 'ai', 'ingestion', 'scheduler', 'api', 'auth', 'correlation', 'ui'],
        required: true,
        index: true
    },
    action: { type: String, required: true, index: true },
    message: { type: String, required: true },
    userId: { type: String, index: true },
    userEmail: { type: String, index: true },
    deviceId: { type: String, index: true },
    scanId: { type: String, index: true },
    cveId: { type: String, index: true },
    correlationId: { type: String, index: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
    error: {
        name: String,
        message: String,
        stack: String,
        code: String
    },
    duration: { type: Number },
    success: { type: Boolean, required: true, index: true },
    ipAddress: { type: String },
    userAgent: { type: String }
});
// Compound indexes for efficient queries
SystemLogSchema.index({ timestamp: -1, level: 1 });
SystemLogSchema.index({ component: 1, timestamp: -1 });
SystemLogSchema.index({ success: 1, timestamp: -1 });
SystemLogSchema.index({ userId: 1, timestamp: -1 });
SystemLogSchema.index({ deviceId: 1, timestamp: -1 });
// TTL index - logs expire after 30 days
SystemLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
exports.default = mongoose_1.default.model('SystemLog', SystemLogSchema);
