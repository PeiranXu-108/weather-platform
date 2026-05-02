'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/app/i18n';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>{children}</I18nProvider>
    </SessionProvider>
  );
}

