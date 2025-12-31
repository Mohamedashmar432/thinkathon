import mongoose, { Document, Schema } from 'mongoose';

export interface IThreatCorrelation extends Document {
  cveId: string;
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  impactedEndpoints: string[];
  impactedSoftware: Array<{
    name: string;
    version: string;
    endpoints: string[];
  }>;
  riskScore: number;
  riskFactors: {
    cvssScore: number;
    exploitedMultiplier: number;
    endpointCount: number;
    internetExposure: boolean;
    criticalSystem: boolean;
  };
  lastChecked: Date;
  threatDetails: {
    severity: string;
    exploited: boolean;
    cisaKev: boolean;
    exploitAvailable: boolean;
  };
  actionRecommendations: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ThreatCorrelationSchema = new Schema<IThreatCorrelation>({
  cveId: { 
    type: String, 
    required: true, 
    index: true,
    uppercase: true
  },
  userId: { 
    type: Schema.Types.ObjectId, 
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
ThreatCorrelationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to calculate risk score
ThreatCorrelationSchema.statics.calculateRiskScore = function(factors: any): number {
  const {
    cvssScore,
    exploitedMultiplier = 1,
    endpointCount,
    internetExposure = false,
    criticalSystem = false
  } = factors;

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

export default mongoose.model<IThreatCorrelation>('ThreatCorrelation', ThreatCorrelationSchema);