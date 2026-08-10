'use client';

import { Providers } from '@/components/providers';
import { ReactNode } from 'react';

export function ProvidersWrapper({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}