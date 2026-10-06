'use client';

import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/cart';
import { LocationProvider } from '@/lib/location';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocationProvider>
      <CartProvider>{children}</CartProvider>
    </LocationProvider>
  );
}
