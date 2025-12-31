import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  apiKey: string;
  role: string;
  createdAt: Date;
  lastLogin?: Date;
  // Onboarding state tracking
  hasScanned: boolean;
  securityScore: number;
  lastScoreUpdate?: Date;
  dailyChecklist?: {
    date: Date;
    items: Array<{
      id: number;
      task: string;
      completed: boolean;
      completedAt?: Date;
    }>;
  };
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    default: '',
  },
  lastName: {
    type: String,
    default: '',
  },
  organization: {
    type: String,
    default: '',
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  role: {
    type: String,
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
  // Onboarding state fields
  hasScanned: {
    type: Boolean,
    default: false,
  },
  securityScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  lastScoreUpdate: {
    type: Date,
  },
  dailyChecklist: {
    date: {
      type: Date,
    },
    items: [{
      id: {
        type: Number,
      },
      task: {
        type: String,
      },
      completed: {
        type: Boolean,
        default: false,
      },
      completedAt: {
        type: Date,
      },
    }],
  },
});

export default mongoose.model<IUser>('User', UserSchema);

