import dbConnect from '@/app/lib/mongodb';
import { ApiUsageModel } from '@/app/lib/models/ApiUsage';

/**
 * Record API usage for a user for the current day.
 * Uses upsert with $inc for atomic increment.
 */
export async function recordApiUsage(userId: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  await dbConnect();

  await ApiUsageModel.findOneAndUpdate(
    { userId, date },
    { $inc: { count: 1 } },
    { upsert: true, new: true }
  );
}
