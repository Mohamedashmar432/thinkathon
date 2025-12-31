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
const ThreatIntelItemSchema = new mongoose_1.Schema({
    cveId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        uppercase: true,
        match: /^CVE-\d{4}-\d{4,}$/
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low'],
        required: true,
        index: true
    },
    cvssScore: {
        type: Number,
        required: true,
        min: 0,
        max: 10
    },
    exploited: {
        type: Boolean,
        default: false,
        index: true
    },
    affectedProducts: [{
            type: String,
            lowercase: true,
            trim: true
        }],
    publishedDate: {
        type: Date,
        required: true,
        index: true
    },
    source: {
        type: String,
        enum: ['nvd', 'cisa_kev', 'otx'],
        required: true
    },
    references: [{ type: String }],
    cisaKevDate: { type: Date },
    exploitationDetails: {
        campaigns: [{ type: String }],
        iocs: [{ type: String }],
        exploitAvailable: { type: Boolean, default: false }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Compound indexes for efficient queries
ThreatIntelItemSchema.index({ severity: 1, publishedDate: -1 });
ThreatIntelItemSchema.index({ exploited: 1, severity: 1 });
ThreatIntelItemSchema.index({ publishedDate: -1, severity: 1 });
ThreatIntelItemSchema.index({ affectedProducts: 1, severity: 1 });
// Update timestamp on save
ThreatIntelItemSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
// Static method to normalize product names
ThreatIntelItemSchema.statics.normalizeProductName = function (productName) {
    return productName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};
exports.default = mongoose_1.default.model('ThreatIntelItem', ThreatIntelItemSchema);
