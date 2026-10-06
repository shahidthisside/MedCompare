'use client';
// User location (PIN + city): detected via browser geolocation or entered manually. Persisted in localStorage.

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { UserLocation } from './types';

const KEY = 'medcompare:location';
export const DEFAULT_LOCATION: UserLocation = { pin: '110001', city: 'New Delhi', district: 'Central Delhi', state: 'Delhi' };

interface LocationCtx {
  location: UserLocation | null; // null until hydrated
  isDefault: boolean;
  setLocation: (l: UserLocation) => void;
  lookupPin: (pin: string) => Promise<UserLocation>;
  detect: () => Promise<UserLocation>;
}

const Ctx = createContext<LocationCtx | null>(null);

async function api(url: string): Promise<UserLocation> {
  const r = await fetch(url);
  const j = (await r.json()) as UserLocation & { error?: { message?: string } };
  if (!r.ok || j.error) throw new Error(j.error?.message ?? 'Lookup failed');
  return j;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLoc] = useState<UserLocation | null>(null);
  const [isDefault, setIsDefault] = useState(true);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as UserLocation | null;
      if (saved?.pin && saved.city) { setLoc(saved); setIsDefault(false); return; }
    } catch { /* ignore corrupt storage */ }
    setLoc(DEFAULT_LOCATION);
  }, []);

  const setLocation = useCallback((l: UserLocation) => {
    setLoc(l);
    setIsDefault(false);
    localStorage.setItem(KEY, JSON.stringify(l));
  }, []);

  const lookupPin = useCallback((pin: string) => api(`/api/location?pin=${encodeURIComponent(pin)}`), []);

  const detect = useCallback(
    () =>
      new Promise<UserLocation>((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject(new Error('Location is not supported by this browser'));
        navigator.geolocation.getCurrentPosition(
          (p) => api(`/api/location?lat=${p.coords.latitude}&lng=${p.coords.longitude}`).then(resolve, reject),
          (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? 'Location permission denied. Enter your PIN instead.' : 'Could not detect location')),
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
        );
      }),
    [],
  );

  return <Ctx.Provider value={{ location, isDefault, setLocation, lookupPin, detect }}>{children}</Ctx.Provider>;
}

export function useLocation(): LocationCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLocation must be used inside LocationProvider');
  return c;
}
