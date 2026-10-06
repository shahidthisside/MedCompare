// Tiny in-memory TTL cache + per-IP rate limiter for route handlers (single-process; swap for KV/Redis when deployed multi-instance).

interface Entry<T> { value: T; exp: number }

export class TtlCache<T> {
  private map = new Map<string, Entry<T>>();
  constructor(private ttlMs: number, private max = 2000) {}
  get(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.exp < Date.now()) { this.map.delete(key); return undefined; }
    return e.value;
  }
  set(key: string, value: T, ttlMs = this.ttlMs): void {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string);
    this.map.set(key, { value, exp: Date.now() + ttlMs });
  }
}

/** Sliding window: max `limit` hits per `windowMs` per key. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private windowMs: number) {}
  allow(key: string): boolean {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.limit) { this.hits.set(key, list); return false; }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.hits.clear();
    return true;
  }
}

/** De-duplicates concurrent identical requests (many users searching the same thing at once). */
export function singleFlight<T>() {
  const inflight = new Map<string, Promise<T>>();
  return (key: string, fn: () => Promise<T>): Promise<T> => {
    const cur = inflight.get(key);
    if (cur) return cur;
    const p = fn().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}
