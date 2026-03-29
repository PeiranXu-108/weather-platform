import { NextResponse, type NextRequest } from 'next/server';

import dbConnect from '@/app/lib/mongodb';
import { UserModel, type FavoriteCity } from '@/app/lib/models/User';
import { getAuthUserFromRequest } from '@/app/lib/serverAuth';

type FavoriteCityInput = { query: string; label?: string };

export async function POST(req: NextRequest) {
  const authUser = await getAuthUserFromRequest(req);
  const email = authUser?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { favorites?: FavoriteCityInput[] } | null;
  const favorites = body?.favorites;
  if (!Array.isArray(favorites)) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  await dbConnect();
  const dbUser = await UserModel.findOne({ email });
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existing = new Set(dbUser.favorites.map((f: FavoriteCity) => f.query));
  for (const fav of favorites) {
    if (!fav?.query || existing.has(fav.query)) continue;
    dbUser.favorites.push({ query: fav.query, label: fav.label, addedAt: new Date() });
    existing.add(fav.query);
  }

  await dbUser.save();
  return NextResponse.json(dbUser.favorites);
}

