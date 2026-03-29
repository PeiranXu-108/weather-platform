import { NextResponse, type NextRequest } from 'next/server';

import dbConnect from '@/app/lib/mongodb';
import { UserModel, type FavoriteCity } from '@/app/lib/models/User';
import { getAuthUserFromRequest } from '@/app/lib/serverAuth';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUserFromRequest(req);
  const email = authUser?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const dbUser = await UserModel.findOne({ email }).lean();
  return NextResponse.json(dbUser?.favorites ?? []);
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUserFromRequest(req);
  const email = authUser?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { query?: string; label?: string } | null;
  if (!body?.query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  await dbConnect();
  const dbUser = await UserModel.findOne({ email });
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (!dbUser.favorites.some((f: FavoriteCity) => f.query === body.query)) {
    dbUser.favorites.unshift({ query: body.query, label: body.label, addedAt: new Date() });
    await dbUser.save();
  }

  return NextResponse.json(dbUser.favorites);
}

export async function DELETE(req: NextRequest) {
  const authUser = await getAuthUserFromRequest(req);
  const email = authUser?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  await dbConnect();
  const dbUser = await UserModel.findOne({ email });
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  dbUser.favorites = dbUser.favorites.filter((f: FavoriteCity) => f.query !== query);
  await dbUser.save();

  return NextResponse.json(dbUser.favorites);
}

