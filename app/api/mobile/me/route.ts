import { NextRequest, NextResponse } from 'next/server';

import { getAuthUserFromRequest } from '@/app/lib/serverAuth';

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user?.id || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
  });
}
