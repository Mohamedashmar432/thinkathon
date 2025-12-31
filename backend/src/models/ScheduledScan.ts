import mongoose, { Document, Schema } from 'mongoose';

export interface IScheduledScan extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  deviceId: string;
  scanType: 'quick' | 'health';
  enabled: boolean;
  scheduledTimeIST: string; // Format: "05:00" (24-hour format)
  scheduledTimeUTC: string; // Format: "23:30" (converted from IST)
  timezone: string; // "Asia/Kolkata"
  lastRun?: Date;
  nextRun: Date;
  missedRuns: number;
  totalRuns: number;
  createdAt: Date;
  updatedAt: Date;
  calculateNextRun(): Date;
}

const ScheduledScanSchema = new Schema<IScheduledScan>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userEmail: { type: String, required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  scanType: { type: String, enum: ['quick', 'health'], required: true },
  enabled: { type: Boolean, default: true },
  scheduledTimeIST: { type: String, required: true, default: '05:00' },
  scheduledTimeUTC: { type: String, required: true, default: '23:30' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  lastRun: { type: Date },
  nextRun: { type: Date, required: true, index: true },
  missedRuns: { type: Number, default: 0 },
  totalRuns: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound index for efficient queries
ScheduledScanSchema.index({ userId: 1, deviceId: 1, scanType: 1 }, { unique: true });
ScheduledScanSchema.index({ enabled: 1, nextRun: 1 }); // For scheduler queries

// Update the updatedAt field on save
ScheduledScanSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Helper method to calculate next run time
ScheduledScanSchema.methods.calculateNextRun = function(this: IScheduledScan) {
  const now = new Date();
  const [hours, minutes] = this.scheduledTimeUTC.split(':').map(Number);
  
  // Create next run date in UTC
  const nextRun = new Date();
  nextRun.setUTCHours(hours, minutes, 0, 0);
  
  // If the time has already passed today, schedule for tomorrow
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }
  
  this.nextRun = nextRun;
  return nextRun;
};

// Helper method to convert IST to UTC
ScheduledScanSchema.statics.convertISTToUTC = function(istTime: string): string {
  const [hours, minutes] = istTime.split(':').map(Number);
  
  // IST is UTC+5:30, so subtract 5 hours and 30 minutes
  let utcHours = hours - 5;
  let utcMinutes = minutes - 30;
  
  // Handle minute underflow
  if (utcMinutes < 0) {
    utcMinutes += 60;
    utcHours -= 1;
  }
  
  // Handle hour underflow (previous day)
  if (utcHours < 0) {
    utcHours += 24;
  }
  
  return `${utcHours.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}`;
};

export default mongoose.model<IScheduledScan>('ScheduledScan', ScheduledScanSchema);