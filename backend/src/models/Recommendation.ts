import mongoose, { Document, Schema } from 'mongoose';

export interface IRecommendation extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  deviceId: string;
  recommendationId: string;
  title: string;
  description: string;
  action: string;
  whyItMatters: string;
  expectedRiskReduction: number;
  priority: 'high' | 'medium' | 'low';
  category: 'endpoint' | 'system' | 'network' | 'application';
  userActionable: boolean;
  estimatedTimeMinutes: number;
  status: 'not_started' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date; // Recommendations expire after 7 days
  scanId?: mongoose.Types.ObjectId;
  softwareName?: string;
  vulnerabilityIds?: string[];
}

const RecommendationSchema = new Schema<IRecommendation>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
  scanId: { type: Schema.Types.ObjectId, ref: 'Scan' },
  softwareName: { type: String },
  vulnerabilityIds: [{ type: String }],
});

// Index for efficient queries
RecommendationSchema.index({ userId: 1, deviceId: 1, status: 1 });
RecommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired recommendations

// Update the updatedAt field on save
RecommendationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IRecommendation>('Recommendation', RecommendationSchema);