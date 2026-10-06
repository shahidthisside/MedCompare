'use client';

import { useEffect, useState } from 'react';
import { SOURCES } from '@/lib/sources/meta';
import type { SourceId, UserLocation } from '@/lib/types';
import type { SourceState } from '@/lib/useLiveSearch';
import { cx, Icon, PharmacyLogo } from './ui';

export function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}

export function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s} sec ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hr ago`;
}

/** Location + live progress across pharmacies. */
export function SourceStatus({ states, pending, location, onRefresh, onChangeLocation }: {
  states: Record<SourceId, SourceState>;
  pending: number;
  location: UserLocation;
  onRefresh: () => void;
  onChangeLocation: () => void;
}) {
  const now = useNow();
  const results = SOURCES.flatMap((s) => { const st = states[s.id]; return st.status === 'done' ? [st.result] : []; });
  const latest = results.map((r) => r.fetchedAt).sort().at(-1);
  const done = SOURCES.length - pending;

  return (
    <div className="rounded-xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          <Icon name="pin" className="size-4 text-brand" />
          Showing prices for <span className="font-semibold text-ink">{location.city} {location.pin}</span>
          <button type="button" onClick={onChangeLocation} className="font-semibold text-brand hover:text-brand-strong">Change</button>
        </p>
        <div className="flex items-center gap-3 text-[13px] text-ink-3" aria-live="polite">
          {pending > 0 ? <span>Checking pharmacies… <span className="num font-medium text-ink-2">{done}/{SOURCES.length}</span></span> : <span>Updated {latest ? ago(latest, now) : '–'}</span>}
          <button type="button" onClick={onRefresh} disabled={pending > 0} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-2.5 text-[13px] font-semibold text-ink-2 shadow-card transition hover:bg-surface-2 disabled:opacity-50">
            <Icon name="refresh" className={cx('size-3.5', pending > 0 && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>
      <div className="h-0.5 bg-surface-2">
        <div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${(done / SOURCES.length) * 100}%` }} />
      </div>
      <ul className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-2.5">
        {SOURCES.map((s) => {
          const st = states[s.id];
          const r = st.status === 'done' ? st.result : undefined;
          const n = r?.listings.length ?? 0;
          return (
            <li key={s.id} title={r && !r.ok ? `Unavailable: ${r.error}` : undefined} className={cx('flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px]', r?.ok && n ? 'text-ink-2' : 'text-ink-4')}>
              <PharmacyLogo id={s.id} size={18} className={cx(!r && 'opacity-40', r && (!r.ok || !n) && 'opacity-40 grayscale')} />
              {s.short}
              {!r ? <span className="size-3 animate-spin rounded-full border-[1.5px] border-line-2 border-t-brand" /> : r.ok ? (n ? <Icon name="check" className="size-3.5 text-ok" /> : <span className="text-[11.5px]">no match</span>) : <span className="text-[11.5px] text-bad">unavailable</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
