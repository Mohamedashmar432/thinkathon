import mongoose, { Schema, Document } from 'mongoose';

export interface IEndpoint extends Document {
  scanId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  exposureScore: number;
  vulnerabilities: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  detectedAt: Date;
}

const EndpointSchema = new Schema<IEndpoint>({
  scanId: {
    type: Schema.Types.ObjectId,
    ref: 'Scan',
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  endpoint: {
    type: String,
    required: true,
  },
  exposureScore: {
    type: Number,
    required: true,
  },
  vulnerabilities: [String],
  riskLevel: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    required: true,
  },
  recommendation: String,
  detectedAt: {
    type: Date,
    default: Date.now,
  },
});

EndpointSchema.index({ userId: 1, detectedAt: -1 });
EndpointSchema.index({ endpoint: 1 });

export default mongoose.model<IEndpoint>('Endpoint', EndpointSchema);

