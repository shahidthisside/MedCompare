'use client';
// Live search: calls every pharmacy relay in parallel and updates as each one answers.

import { useEffect, useMemo, useRef, useState } from 'react';
import { groupListings } from './match';
import { SOURCES } from './sources/meta';
import type { ProductGroup, SourceId, SourceResult, UserLocation } from './types';

export type SourceState = { status: 'loading' } | { status: 'done'; result: SourceResult };

export interface LiveSearch {
  states: Record<SourceId, SourceState>;
  groups: ProductGroup[];
  pending: number;
  startedAt: number;
  refresh: () => void;
}

const initial = (): Record<SourceId, SourceState> => Object.fromEntries(SOURCES.map((s) => [s.id, { status: 'loading' }])) as Record<SourceId, SourceState>;

export function useLiveSearch(query: string, loc: UserLocation | null): LiveSearch {
  const [states, setStates] = useState(initial);
  const [nonce, setNonce] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!loc || query.trim().length < 2) return;
    const ctrl = new AbortController();
    startedAt.current = Date.now();
    setStates(initial());
    const params = new URLSearchParams({ q: query.trim(), pin: loc.pin, city: loc.city });
    for (const s of SOURCES) {
      fetch(`/api/search/${s.id}?${params}${nonce ? `&r=${nonce}` : ''}`, { signal: ctrl.signal })
        .then(async (r) => {
          const body = (await r.json()) as SourceResult | { error?: { message?: string } };
          if ('source' in body) return body;
          return { source: s.id, ok: false, listings: [], error: body.error?.message ?? `HTTP ${r.status}`, tookMs: 0, fetchedAt: new Date().toISOString() } satisfies SourceResult;
        })
        .catch((e: unknown): SourceResult | undefined =>
          ctrl.signal.aborted ? undefined : { source: s.id, ok: false, listings: [], error: String(e), tookMs: 0, fetchedAt: new Date().toISOString() },
        )
        .then((result) => {
          if (result && !ctrl.signal.aborted) setStates((prev) => ({ ...prev, [s.id]: { status: 'done', result } }));
        });
    }
    return () => ctrl.abort();
  }, [query, loc?.pin, loc?.city, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const all = Object.values(states).flatMap((s) => (s.status === 'done' ? s.result.listings : []));
    return groupListings(all, query);
  }, [states, query]);

  const pending = Object.values(states).filter((s) => s.status === 'loading').length;
  return { states, groups, pending, startedAt: startedAt.current, refresh: () => setNonce((n) => n + 1) };
}
