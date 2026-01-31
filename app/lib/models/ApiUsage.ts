import mongoose, { Schema } from 'mongoose';

export type ApiUsageDoc = {
  userId: string;
  date: string; // YYYY-MM-DD
  count: number;
};

const ApiUsageSchema = new Schema<ApiUsageDoc>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    count: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

ApiUsageSchema.index({ userId: 1, date: 1 }, { unique: true });

export const ApiUsageModel =
  mongoose.models.ApiUsage || mongoose.model<ApiUsageDoc>('ApiUsage', ApiUsageSchema);
