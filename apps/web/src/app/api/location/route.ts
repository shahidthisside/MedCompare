// GET /api/location?pin=122001            → { pin, city, district, state }
// GET /api/location?lat=28.45&lng=77.02   → reverse geocode to the same shape (PIN included when available)
// Uses India Post data (api.postalpincode.in) and OpenStreetMap Nominatim; both free, keyless.

import { z } from 'zod';
import { clientIp, RateLimiter, TtlCache } from '@/lib/server/cache';
import type { UserLocation } from '@/lib/types';

export const dynamic = 'force-dynamic';

const cache = new TtlCache<UserLocation>(7 * 24 * 3600_000, 5000);
const limiter = new RateLimiter(30, 60_000);
const UA = 'MedCompare/0.1 (+https://github.com/shahidthisside/MedCompare)';

const Pin = z.object({ pin: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code') });
const Coords = z.object({ lat: z.coerce.number().min(6).max(37.5), lng: z.coerce.number().min(68).max(98) });

const CITY_FIX: Record<string, string> = { Gurugram: 'Gurgaon', Bengaluru: 'Bangalore', 'Bangalore Urban': 'Bangalore', 'Mumbai Suburban': 'Mumbai', 'Mumbai City': 'Mumbai', 'Central Delhi': 'New Delhi', 'New Delhi': 'New Delhi', 'South Delhi': 'New Delhi', 'North Delhi': 'New Delhi', 'East Delhi': 'New Delhi', 'West Delhi': 'New Delhi', 'South West Delhi': 'New Delhi', 'North West Delhi': 'New Delhi', 'North East Delhi': 'New Delhi', 'Shahdara': 'New Delhi', 'South East Delhi': 'New Delhi', 'Gautam Buddha Nagar': 'Noida', 'K.V.Rangareddy': 'Hyderabad', 'Rangareddy': 'Hyderabad', 'Medchal Malkajgiri': 'Hyderabad', 'Hyderabad': 'Hyderabad', 'Kolkata': 'Kolkata', 'North 24 Parganas': 'Kolkata' };
const cityFrom = (district: string) => CITY_FIX[district] ?? district;

async function byPin(pin: string): Promise<UserLocation | undefined> {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': UA } });
  if (res.ok) {
    const j = (await res.json()) as { Status?: string; PostOffice?: { District?: string; State?: string; Block?: string }[] | null }[];
    const po = j[0]?.Status === 'Success' ? j[0].PostOffice?.[0] : undefined;
    if (po?.District) return { pin, city: cityFrom(po.District), district: po.District, state: po.State };
    if (j[0]?.Status === 'Error') return undefined;
  }
  // Fallback: Nominatim postal code search
  const n = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&postalcode=${pin}&country=India&limit=1`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': UA } });
  const a = ((await n.json()) as { address?: Record<string, string> }[])[0]?.address;
  if (!a) return undefined;
  const district = a.city ?? a.state_district ?? a.county ?? a.town ?? '';
  return district ? { pin, city: cityFrom(district), district, state: a.state } : undefined;
}

async function byCoords(lat: number, lng: number): Promise<UserLocation | undefined> {
  const n = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=16&lat=${lat}&lon=${lng}`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': UA, 'accept-language': 'en' } });
  const a = ((await n.json()) as { address?: Record<string, string> }).address;
  if (!a) return undefined;
  const pin = (a.postcode ?? '').replace(/\s/g, '');
  if (/^[1-9]\d{5}$/.test(pin)) {
    const exact = await byPin(pin).catch(() => undefined);
    if (exact) return exact;
  }
  const district = a.city ?? a.state_district ?? a.county ?? a.town ?? '';
  if (!district) return undefined;
  return { pin: /^[1-9]\d{5}$/.test(pin) ? pin : '', city: cityFrom(district), district, state: a.state };
}

export async function GET(req: Request) {
  if (!limiter.allow(clientIp(req))) return Response.json({ error: { code: 'rate_limited', message: 'Too many lookups, try again shortly.' } }, { status: 429 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  try {
    if (params.pin !== undefined) {
      const p = Pin.safeParse(params);
      if (!p.success) return Response.json({ error: { code: 'bad_pin', message: p.error.issues[0]?.message } }, { status: 400 });
      const cached = cache.get(p.data.pin);
      const loc = cached ?? (await byPin(p.data.pin));
      if (!loc) return Response.json({ error: { code: 'not_found', message: 'PIN code not found' } }, { status: 404 });
      cache.set(p.data.pin, loc);
      return Response.json(loc);
    }
    const c = Coords.safeParse(params);
    if (!c.success) return Response.json({ error: { code: 'bad_request', message: 'Provide pin, or lat & lng inside India' } }, { status: 400 });
    const key = `${c.data.lat.toFixed(3)},${c.data.lng.toFixed(3)}`;
    const loc = cache.get(key) ?? (await byCoords(c.data.lat, c.data.lng));
    if (!loc) return Response.json({ error: { code: 'not_found', message: 'Could not resolve your location' } }, { status: 404 });
    cache.set(key, loc);
    return Response.json(loc);
  } catch {
    return Response.json({ error: { code: 'upstream', message: 'Location service unavailable, enter your PIN code' } }, { status: 502 });
  }
}
