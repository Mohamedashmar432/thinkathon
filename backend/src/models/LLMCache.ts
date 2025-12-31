import mongoose, { Document, Schema } from 'mongoose';

export interface ILLMCache extends Document {
  cacheKey: string;
  recommendations: any[];
  expiresAt: Date;
  createdAt: Date;
}

const LLMCacheSchema = new Schema<ILLMCache>({
  cacheKey: { type: String, required: true, unique: true, index: true },
  recommendations: { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

// Auto-delete expired cache entries
LLMCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ILLMCache>('LLMCache', LLMCacheSchema);