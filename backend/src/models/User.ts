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
  firstName: String,
  lastName: String,
  organization: String,
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
  lastLogin: Date,
  dailyChecklist: {
    date: Date,
    items: [{
      id: Number,
      task: String,
      completed: Boolean,
      completedAt: Date,
    }],
  },
});

export default mongoose.model<IUser>('User', UserSchema);

