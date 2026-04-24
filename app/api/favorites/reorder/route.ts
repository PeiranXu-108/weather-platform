import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/lib/auth';
import dbConnect from '@/app/lib/mongodb';
import { UserModel, type FavoriteCity } from '@/app/lib/models/User';

type FavoriteCityInput = { query: string; label?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { favorites?: FavoriteCityInput[] } | null;
  const favorites = body?.favorites;
  if (!Array.isArray(favorites)) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  await dbConnect();
  const user = await UserModel.findOne({ email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existingByQuery = new Map<string, FavoriteCity>();
  for (const f of user.favorites) existingByQuery.set(f.query, f);

  const next: FavoriteCity[] = [];
  const seen = new Set<string>();
  for (const fav of favorites) {
    const query = fav?.query?.trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);

    const prev = existingByQuery.get(query);
    next.push({
      query,
      label: fav.label ?? prev?.label,
      addedAt: prev?.addedAt ?? new Date(),
    });
  }

  user.favorites = next;
  await user.save();
  return NextResponse.json(user.favorites);
}

