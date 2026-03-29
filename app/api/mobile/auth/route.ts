import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/app/lib/mongodb';
import { UserModel } from '@/app/lib/models/User';
import { createMobileToken } from '@/app/lib/mobileToken';

type Body = {
  email?: string;
  password?: string;
  isRegister?: boolean;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? '';
  const isRegister = Boolean(body?.isRegister);

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
  }

  await dbConnect();
  const existing = await UserModel.findOne({ email });

  if (isRegister) {
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await UserModel.create({ email, passwordHash, favorites: [] });
    const token = createMobileToken({ id: created._id.toString(), email: created.email });
    return NextResponse.json({
      token,
      user: { id: created._id.toString(), email: created.email },
    });
  }

  if (!existing?.passwordHash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const matched = await bcrypt.compare(password, existing.passwordHash);
  if (!matched) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = createMobileToken({ id: existing._id.toString(), email: existing.email });
  return NextResponse.json({
    token,
    user: { id: existing._id.toString(), email: existing.email },
  });
}
