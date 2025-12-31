import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemLog extends Document {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  component: 'agent' | 'scan' | 'ai' | 'ingestion' | 'scheduler' | 'api' | 'auth' | 'correlation' | 'ui';
  action: string;
  message: string;
  userId?: string;
  userEmail?: string;
  deviceId?: string;
  scanId?: string;
  cveId?: string;
  correlationId?: string;
  metadata?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
}

const SystemLogSchema = new Schema<ISystemLog>({
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
  metadata: { type: Schema.Types.Mixed },
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

export default mongoose.model<ISystemLog>('SystemLog', SystemLogSchema);