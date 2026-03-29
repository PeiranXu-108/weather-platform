import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/app/lib/mongodb';
import { ApiUsageModel } from '@/app/lib/models/ApiUsage';
import { getAuthUserFromRequest } from '@/app/lib/serverAuth';

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const startDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const docs = await ApiUsageModel.find({
    userId,
    date: { $gte: startDate },
  })
    .sort({ date: 1 })
    .lean();

  const usageMap = new Map<string, number>();
  docs.forEach((d) => usageMap.set(d.date, d.count));

  const daily: { date: string; count: number }[] = [];
  let total = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = usageMap.get(dateStr) ?? 0;
    daily.push({ date: dateStr, count });
    total += count;
  }

  return NextResponse.json({ total, daily });
}
