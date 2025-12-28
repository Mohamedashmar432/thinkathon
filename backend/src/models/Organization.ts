import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  domain: string;
  name: string;
  secureScore: number;
  totalMembers: number;
  totalDevices: number;
  scoreHistory: Array<{
    date: Date;
    score: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>({
  domain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  name: String,
  secureScore: {
    type: Number,
    default: 0,
  },
  totalMembers: {
    type: Number,
    default: 0,
  },
  totalDevices: {
    type: Number,
    default: 0,
  },
  scoreHistory: [{
    date: Date,
    score: Number,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);

