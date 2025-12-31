import mongoose, { Schema, Document } from 'mongoose';

export interface IScan extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  deviceId: string;
  scanTimestamp: Date;
  scanType?: 'quick' | 'full' | 'health';
  isScheduled?: boolean;
  scheduledScanId?: mongoose.Types.ObjectId;
  systemInfo: {
    computerName: string;
    osName: string;
    osVersion: string;
    osBuild: string;
    architecture: string;
    manufacturer: string;
    model: string;
  };
  software: Array<{
    name: string;
    version: string;
    publisher: string;
    installDate: string;
  }>;
  browserExtensions?: Array<{
    browser: string;
    name: string;
    version: string;
    extensionId: string;
  }>;
  patches: {
    totalPatches: number;
    latestPatchId: string;
    latestPatchDate: Date;
  };
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    exploitable: number;
    items: Array<{
      software: string;
      version: string;
      cveId: string;
      cvssScore: number;
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
      exploitable: boolean;
      recommendation: string;
      affectedEndpoints?: string[];
    }>;
  };
  secureScore: number;
  endpointExposureScore: number;
  status: 'pending' | 'running' | 'analyzing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  analyzedAt?: Date;
}

const ScanSchema = new Schema<IScan>({
  userId: {
    type: Schema.Types.ObjectId,
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
    type: Schema.Types.ObjectId,
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

export default mongoose.model<IScan>('Scan', ScanSchema);

