// GET /api/suggest?q=dol → { q, suggestions: [{ name, composition? }] }
// Type-ahead built from the fastest live pharmacy APIs (1mg + Medkart), cached 1 hour per prefix.

import { z } from 'zod';
import { nameKey } from '@/lib/match';
import { clientIp, RateLimiter, singleFlight, TtlCache } from '@/lib/server/cache';
import { ADAPTERS } from '@/lib/sources/adapters';
import type { Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';

export interface Suggestion { name: string; composition?: string }

const cache = new TtlCache<Suggestion[]>(60 * 60_000, 5000);
const flight = singleFlight<Suggestion[]>();
const limiter = new RateLimiter(240, 60_000);
const Q = z.object({ q: z.string().trim().min(2).max(60) });
const DEFAULT_LOC = { pin: '110001', city: 'New Delhi' };

function clean(name: string): string {
  const s = name.replace(/\s*\|.*$/, '').replace(/\s+/g, ' ').trim();
  return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()) : s;
}

async function build(q: string): Promise<Suggestion[]> {
  const sources = [ADAPTERS.tata1mg, ADAPTERS.medkart];
  const results = await Promise.allSettled(sources.map(async (a) => a.parse(await a.fetch(q, DEFAULT_LOC, AbortSignal.timeout(2500)), q)));
  const listings: Listing[] = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const ql = q.toLowerCase();
  const seen = new Map<string, Suggestion & { score: number }>();
  listings.forEach((l, i) => {
    const name = clean(l.name);
    const key = nameKey(name);
    if (!key || seen.has(key)) return;
    const lower = name.toLowerCase();
    // Rank: name starts with query > a word starts with query > anything else; then source order.
    const score = (lower.startsWith(ql) ? 0 : lower.split(/[^a-z0-9]+/).some((w) => w.startsWith(ql.split(' ')[0] ?? '')) ? 1 : 2) * 1000 + i;
    seen.set(key, { name, composition: l.composition ? clean(l.composition) : undefined, score });
  });
  return [...seen.values()].sort((a, b) => a.score - b.score).slice(0, 8).map(({ name, composition }) => ({ name, composition }));
}

export async function GET(req: Request) {
  const p = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return Response.json({ q: '', suggestions: [] });
  if (!limiter.allow(clientIp(req))) return Response.json({ error: { code: 'rate_limited', message: 'Slow down' } }, { status: 429 });
  const q = p.data.q.toLowerCase();
  const hit = cache.get(q);
  if (hit) return Response.json({ q, suggestions: hit });
  const suggestions = await flight(q, () => build(q));
  if (suggestions.length) cache.set(q, suggestions);
  return Response.json({ q, suggestions });
}
