import crypto from 'crypto';

type MobileTokenPayload = {
  sub: string;
  email: string;
  exp: number;
};

const MOBILE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function secret() {
  return process.env.NEXTAUTH_SECRET || 'weather-mobile-dev-secret';
}

function sign(payloadBase64: string) {
  return crypto.createHmac('sha256', secret()).update(payloadBase64).digest('base64url');
}

export function createMobileToken(user: { id: string; email: string }) {
  const payload: MobileTokenPayload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + MOBILE_TOKEN_TTL_SECONDS,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifyMobileToken(token: string): MobileTokenPayload | null {
  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) return null;
  if (sign(payloadBase64) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString()) as MobileTokenPayload;
    if (!payload?.sub || !payload?.email || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
