import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const AUTH_TOKEN_KEY = 'wp:mobileToken:v1';

type AuthState = {
  token: string | null;
  email: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (token: string, email: string) => Promise<void>;
  clearSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  email: null,
  hydrated: false,
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { token: string; email: string };
      set({ token: parsed.token, email: parsed.email, hydrated: true });
      return;
    }
    set({ token: null, email: null, hydrated: true });
  },
  setSession: async (token, email) => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify({ token, email }));
    set({ token, email });
  },
  clearSession: async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    set({ token: null, email: null });
  },
}));
