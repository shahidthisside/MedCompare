// GET /api/search/:source?q=…&pin=…&city=…
// Server-side relay to one pharmacy's live API. The browser calls all pharmacies in parallel, so results stream in independently.

import { z } from 'zod';
import { clientIp, RateLimiter, singleFlight, TtlCache } from '@/lib/server/cache';
import { ADAPTERS, oneMgCity } from '@/lib/sources/adapters';
import type { SourceId, SourceResult } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const CACHE_TTL_MS = 10 * 60_000; // prices are re-fetched at most every 10 min per (source, query, location)
const TIMEOUT_MS = 8_000;
const RETRY_TIMEOUT_MS = 5_000;
const cache = new TtlCache<SourceResult>(CACHE_TTL_MS);
const flight = singleFlight<SourceResult>();
const limiter = new RateLimiter(120, 60_000); // per IP: 120 source-requests/min (= ~17 searches/min across 7 sources)

const Query = z.object({
  q: z.string().trim().min(2).max(80),
  pin: z.string().regex(/^[1-9]\d{5}$/),
  city: z.string().trim().min(2).max(60),
});

export async function GET(req: Request, ctx: { params: Promise<{ source: string }> }) {
  const { source } = await ctx.params;
  const adapter = ADAPTERS[source as SourceId];
  if (!adapter) return Response.json({ error: { code: 'unknown_source', message: `Unknown source ${source}` } }, { status: 404 });

  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ error: { code: 'bad_request', message: parsed.error.issues[0]?.message ?? 'Invalid query' } }, { status: 400 });
  if (!limiter.allow(clientIp(req))) return Response.json({ error: { code: 'rate_limited', message: 'Too many searches, wait a minute.' } }, { status: 429 });

  const { q, pin, city } = parsed.data;
  // Only include the location parts this source actually uses, so cache hits are shared across users.
  const locKey = adapter.locationAware === 'pin' ? pin : adapter.locationAware === 'city' ? oneMgCity(city) : '-';
  const key = `${source}|${q.toLowerCase()}|${locKey}`;

  const hit = cache.get(key);
  if (hit) return Response.json({ ...hit, cached: true } satisfies SourceResult, { headers: { 'cache-control': 'no-store' } });

  const result = await flight(key, async () => {
    const started = Date.now();
    try {
      let json: unknown;
      try {
        json = await adapter.fetch(q, { pin, city }, AbortSignal.timeout(TIMEOUT_MS));
      } catch (e) {
        // One quick retry for transient failures (timeouts, resets, 5xx). Blocks and bad requests (4xx) are not retried.
        if (e instanceof Error && /^HTTP 4\d\d/.test(e.message)) throw e;
        json = await adapter.fetch(q, { pin, city }, AbortSignal.timeout(RETRY_TIMEOUT_MS));
      }
      const listings = adapter.parse(json, q);
      const r: SourceResult = { source: adapter.id, ok: true, listings, tookMs: Date.now() - started, fetchedAt: new Date().toISOString() };
      cache.set(key, r);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? (e.name === 'TimeoutError' ? 'Timed out' : e.message) : String(e);
      const r: SourceResult = { source: adapter.id, ok: false, listings: [], error: msg, tookMs: Date.now() - started, fetchedAt: new Date().toISOString() };
      cache.set(key, r, 15_000); // brief negative cache so a broken source isn't hammered
      return r;
    }
  });
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
