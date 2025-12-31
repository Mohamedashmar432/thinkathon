import mongoose, { Schema, Document } from 'mongoose';

export interface IAgent extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId: string;
  deviceName: string;
  status: 'active' | 'inactive' | 'installing' | 'uninstalled' | 'error';
  version: string;
  installedAt: Date;
  lastHeartbeat?: Date;
  lastConnected?: Date;
  lastScan?: Date;
  uninstalledAt?: Date;
  commandHistory: Array<{
    command: string;
    success: boolean;
    result: string;
    timestamp: Date;
  }>;
  systemInfo: {
    osName?: string;
    osVersion?: string;
    architecture?: string;
    manufacturer?: string;
    model?: string;
  };
}

const AgentSchema = new Schema<IAgent>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  deviceId: {
    type: String,
    required: true,
  },
  deviceName: String,
  status: {
    type: String,
    enum: ['active', 'inactive', 'installing', 'uninstalled', 'error'],
    default: 'installing',
  },
  version: String,
  installedAt: {
    type: Date,
    default: Date.now,
  },
  lastHeartbeat: Date,
  lastConnected: Date,
  lastScan: Date,
  uninstalledAt: Date,
  commandHistory: [{
    command: String,
    success: Boolean,
    result: String,
    timestamp: Date,
  }],
  systemInfo: {
    osName: String,
    osVersion: String,
    architecture: String,
    manufacturer: String,
    model: String,
  },
});

AgentSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
AgentSchema.index({ userId: 1, status: 1 });
AgentSchema.index({ lastHeartbeat: 1 });

export default mongoose.model<IAgent>('Agent', AgentSchema);