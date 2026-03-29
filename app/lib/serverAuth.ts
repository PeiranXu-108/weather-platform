import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';

import { authOptions } from '@/app/lib/auth';
import { verifyMobileToken } from '@/app/lib/mobileToken';

export type AuthUser = {
  id?: string;
  email?: string;
};

export async function getAuthUserFromRequest(req?: NextRequest): Promise<AuthUser | null> {
  if (req) {
    const authorization = req.headers.get('authorization');
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim();
      const payload = verifyMobileToken(token);
      if (payload) {
        return { id: payload.sub, email: payload.email };
      }
    }
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!email && !id) return null;
  return { id, email: email ?? undefined };
}
