import clsx from 'clsx';
import { SOURCE_BY_ID } from '@/lib/sources/meta';
import type { SourceId } from '@/lib/types';

export const cx = clsx;

/* ---------- Icons (24px grid, 1.75 stroke) ---------- */
const paths = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  cart: <><path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" /><circle cx="9.5" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  external: <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  chevronRight: <path d="m10 7 5 5-5 5" />,
  locate: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /><circle cx="12" cy="12" r="7" /></>,
  refresh: <><path d="M19.5 8A8 8 0 0 0 5 7.5M4.5 16A8 8 0 0 0 19 16.5" /><path d="M19.5 3.5V8H15M4.5 20.5V16H9" /></>,
  truck: <><path d="M3 6.5h11v9H3zM14 10h4l3 3v2.5h-7z" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></>,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l.8 12a2 2 0 0 0 2 1.9h4.4a2 2 0 0 0 2-1.9L17 7" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 1.5" /></>,
  shield: <><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  tag: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="8" cy="8" r="1.5" /></>,
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  scale: <><path d="M12 4v16M5 20h14M6 8h12" /><path d="m6 8-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  bolt: <path d="M13 3 5 13h6l-1 8 8-10h-6z" />,
  thermometer: <><path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" /><path d="M12 9v7" /></>,
  droplet: <path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11Z" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />,
  pulse: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  stomach: <path d="M9 3v4a4 4 0 0 0 4 4h1a5 5 0 0 1 5 5 5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-1a3 3 0 0 1 3-3" />,
  flower: <><circle cx="12" cy="12" r="2.5" /><path d="M12 9.5a3 3 0 1 1 0-6 3 3 0 1 1 0 6M12 14.5a3 3 0 1 1 0 6 3 3 0 1 1 0-6M9.5 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0M14.5 12a3 3 0 1 1 6 0 3 3 0 1 1-6 0" /></>,
  pill: <><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="m9.5 9.5 5 5" /></>,
  sun2: <><circle cx="12" cy="12" r="3.5" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  lungs: <><path d="M12 4v8M12 12c-1 0-2 .5-2.5 1.5M12 12c1 0 2 .5 2.5 1.5" /><path d="M9 7c-3 1-5 5-5 10 0 2 1.5 3 3 3s2.5-1 2.5-3V9.5C9.5 8 9.3 7.2 9 7ZM15 7c3 1 5 5 5 10 0 2-1.5 3-3 3s-2.5-1-2.5-3V9.5c0-1.5.2-2.3.5-2.5Z" /></>,
};
export type IconName = keyof typeof paths;
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx('size-4 shrink-0', className)}>
      {paths[name]}
    </svg>
  );
}

/* ---------- Pharmacy logo (site icon, served locally from /public/logos) ---------- */
export function PharmacyLogo({ id, size = 24, className }: { id: SourceId; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/logos/${id}.png`} alt="" width={size} height={size} className={cx('shrink-0 rounded-md bg-white object-contain ring-1 ring-line dark:ring-white/10 dark:brightness-95', className)} style={{ width: size, height: size }} />
  );
}

export function Pharmacy({ id, size = 20, className, full = false }: { id: SourceId; size?: number; className?: string; full?: boolean }) {
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-2', className)}>
      <PharmacyLogo id={id} size={size} />
      <span className="truncate">{full ? SOURCE_BY_ID[id].name : SOURCE_BY_ID[id].short}</span>
    </span>
  );
}

/* ---------- Badges ---------- */
export function Badge({ children, tone = 'gray', className }: { children: React.ReactNode; tone?: 'gray' | 'brand' | 'ok' | 'warn' | 'bad'; className?: string }) {
  const tones = {
    gray: 'bg-surface-2 text-ink-2 ring-line',
    brand: 'bg-brand-soft text-brand-strong ring-brand-line',
    ok: 'bg-ok-soft text-ok ring-ok-line',
    warn: 'bg-warn-soft text-warn ring-warn/30',
    bad: 'bg-bad-soft text-bad ring-bad/30',
  };
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>{children}</span>;
}

/* ---------- Product image (pharmacy CDN images; neutral placeholder) ---------- */
export { Thumb } from './Thumb';

export function Button({ variant = 'primary', size = 'md', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-brand text-on-brand hover:bg-brand-strong',
        variant === 'secondary' && 'border border-line-2 bg-surface text-ink-2 shadow-card hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-3 hover:bg-surface-2 hover:text-ink',
        className,
      )}
    />
  );
}
