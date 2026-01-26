import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/app/lib/mongodb';
import { UserModel } from '@/app/lib/models/User';

type FavoriteCity = { query: string; label?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { favorites?: FavoriteCity[] } | null;
  const favorites = body?.favorites;
  if (!Array.isArray(favorites)) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  await dbConnect();
  const user = await UserModel.findOne({ email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existing = new Set(user.favorites.map((f) => f.query));
  for (const fav of favorites) {
    if (!fav?.query || existing.has(fav.query)) continue;
    user.favorites.push({ query: fav.query, label: fav.label, addedAt: new Date() });
    existing.add(fav.query);
  }

  await user.save();
  return NextResponse.json(user.favorites);
}

