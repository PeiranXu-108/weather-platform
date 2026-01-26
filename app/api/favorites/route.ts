import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/app/lib/mongodb';
import { UserModel } from '@/app/lib/models/User';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const user = await UserModel.findOne({ email }).lean();
  return NextResponse.json(user?.favorites ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { query?: string; label?: string } | null;
  if (!body?.query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  await dbConnect();
  const user = await UserModel.findOne({ email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (!user.favorites.some((f) => f.query === body.query)) {
    user.favorites.unshift({ query: body.query, label: body.label, addedAt: new Date() });
    await user.save();
  }

  return NextResponse.json(user.favorites);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  await dbConnect();
  const user = await UserModel.findOne({ email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  user.favorites = user.favorites.filter((f) => f.query !== query);
  await user.save();

  return NextResponse.json(user.favorites);
}

