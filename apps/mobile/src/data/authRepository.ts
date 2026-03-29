import { apiJson } from '@/data/apiClient';

export type MobileAuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
  };
};

export async function mobileLogin(email: string, password: string) {
  return apiJson<MobileAuthResponse>('/api/mobile/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, isRegister: false }),
  });
}

export async function mobileRegister(email: string, password: string) {
  return apiJson<MobileAuthResponse>('/api/mobile/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, isRegister: true }),
  });
}

export async function mobileMe() {
  return apiJson<{ user: { id: string; email: string } }>('/api/mobile/me');
}
