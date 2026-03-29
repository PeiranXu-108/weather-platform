import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/providers/AppProviders';
import { useAuthStore } from '@/state/authStore';

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <AppProviders>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0b1220' },
          headerTintColor: '#e9f0ff',
          contentStyle: { backgroundColor: '#0b1220' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="map" options={{ title: '地图' }} />
        <Stack.Screen name="favorites" options={{ title: '收藏' }} />
        <Stack.Screen name="settings" options={{ title: '设置' }} />
        <Stack.Screen name="auth" options={{ title: '账号' }} />
        <Stack.Screen name="chat" options={{ title: 'AI 助手' }} />
        <Stack.Screen name="profile" options={{ title: '我的统计' }} />
      </Stack>
    </AppProviders>
  );
}
