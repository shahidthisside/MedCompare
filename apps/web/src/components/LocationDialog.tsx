'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useLocation } from '@/lib/location';
import type { UserLocation } from '@/lib/types';
import { Button, cx, Icon } from './ui';

// Location presets (PIN → city), not price data.
const CITIES: UserLocation[] = [
  { pin: '110001', city: 'New Delhi', state: 'Delhi' },
  { pin: '400001', city: 'Mumbai', state: 'Maharashtra' },
  { pin: '560001', city: 'Bangalore', state: 'Karnataka' },
  { pin: '122001', city: 'Gurgaon', state: 'Haryana' },
  { pin: '500001', city: 'Hyderabad', state: 'Telangana' },
  { pin: '600001', city: 'Chennai', state: 'Tamil Nadu' },
  { pin: '700001', city: 'Kolkata', state: 'West Bengal' },
  { pin: '411001', city: 'Pune', state: 'Maharashtra' },
];

export interface LocationDialogHandle { open: () => void }

export const LocationDialog = forwardRef<LocationDialogHandle>(function LocationDialog(_, ref) {
  const dlg = useRef<HTMLDialogElement>(null);
  const { location, setLocation, lookupPin, detect } = useLocation();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState<'pin' | 'gps' | null>(null);
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({ open: () => { setError(''); setPin(''); dlg.current?.showModal(); } }));
  const close = () => dlg.current?.close();
  const done = (l: UserLocation) => { setLocation(l); close(); };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[1-9]\d{5}$/.test(pin)) { setError('Enter a valid 6-digit PIN code.'); return; }
    setBusy('pin'); setError('');
    try { done(await lookupPin(pin)); } catch (err) { setError((err as Error).message); } finally { setBusy(null); }
  };
  const useGps = async () => {
    setBusy('gps'); setError('');
    try {
      const l = await detect();
      if (!l.pin) { setError(`Found ${l.city}, but no PIN code. Please enter it.`); return; }
      done(l);
    } catch (err) { setError((err as Error).message); } finally { setBusy(null); }
  };

  return (
    <dialog ref={dlg} aria-labelledby="loc-title" className="m-auto w-[min(440px,calc(100vw-24px))] rounded-xl border border-line bg-surface p-0 text-ink shadow-pop" onClick={(e) => { if (e.target === dlg.current) close(); }}>
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id="loc-title" className="text-lg font-semibold">Choose delivery location</h2>
          <p className="mt-0.5 text-sm text-ink-3">Prices and delivery times can vary by PIN code.</p>
        </div>
        <button type="button" onClick={close} aria-label="Close" className="-mr-1.5 grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"><Icon name="close" /></button>
      </div>

      <div className="space-y-5 px-5 py-5">
        <form onSubmit={submitPin}>
          <label htmlFor="pin" className="text-sm font-medium text-ink-2">PIN code</label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="pin"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              placeholder="e.g. 400001"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="num h-10 min-w-0 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-[15px] shadow-card outline-none placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
            <Button type="submit" disabled={busy !== null}>{busy === 'pin' ? 'Checking…' : 'Apply'}</Button>
          </div>
        </form>

        <button type="button" onClick={useGps} disabled={busy !== null} className="flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-strong disabled:opacity-50">
          <Icon name="locate" className={cx('size-[18px]', busy === 'gps' && 'animate-spin')} /> {busy === 'gps' ? 'Detecting…' : 'Detect my location'}
        </button>
        {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

        <div>
          <p className="mb-2 text-sm font-medium text-ink-2">Popular cities</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CITIES.map((c) => {
              const on = location?.pin === c.pin;
              return (
                <button key={c.pin} type="button" onClick={() => done(c)} className={cx('rounded-lg border px-3 py-2 text-left text-[13.5px] transition', on ? 'border-brand bg-brand-soft font-semibold text-brand-strong' : 'border-line hover:border-line-2 hover:bg-surface-2')}>
                  {c.city}
                  <span className="num block text-xs font-normal text-ink-3">{c.pin}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </dialog>
  );
});
