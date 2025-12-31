import mongoose, { Document, Schema } from 'mongoose';

export interface IThreatIntelItem extends Document {
  cveId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore: number;
  exploited: boolean;
  affectedProducts: string[];
  publishedDate: Date;
  source: 'nvd' | 'cisa_kev' | 'otx';
  references: string[];
  cisaKevDate?: Date; // When added to CISA KEV list
  exploitationDetails?: {
    campaigns: string[];
    iocs: string[];
    exploitAvailable: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ThreatIntelItemSchema = new Schema<IThreatIntelItem>({
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
ThreatIntelItemSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to normalize product names
ThreatIntelItemSchema.statics.normalizeProductName = function(productName: string): string {
  return productName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export default mongoose.model<IThreatIntelItem>('ThreatIntelItem', ThreatIntelItemSchema);