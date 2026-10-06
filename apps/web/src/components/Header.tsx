'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { useCart } from '@/lib/cart';
import { useLocation } from '@/lib/location';
import { LocationDialog, type LocationDialogHandle } from './LocationDialog';
import { SearchBox } from './SearchBox';
import { ThemeSwitch } from './ThemeSwitch';
import { cx, Icon } from './ui';

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" aria-label="MedCompare home" className="inline-flex shrink-0 items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="8" className={inverted ? 'fill-white' : 'fill-brand'} />
        <path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z" className={inverted ? 'fill-brand' : 'fill-white dark:fill-[#0c111d]'} />
      </svg>
      <span className={cx('text-[19px] font-bold tracking-tight', inverted ? 'text-white' : 'text-ink')}>
        Med<span className={inverted ? 'text-white/80' : 'text-brand'}>Compare</span>
      </span>
    </Link>
  );
}

export function useOpenLocation() {
  return () => window.dispatchEvent(new Event('medcompare:open-location'));
}

const NAV = [
  { href: '/', label: 'Compare prices' },
  { href: '/search?q=paracetamol', label: 'Fever & pain' },
  { href: '/search?q=metformin', label: 'Diabetes' },
  { href: '/search?q=telmisartan', label: 'Blood pressure' },
  { href: '/search?q=pantoprazole', label: 'Acidity' },
  { href: '/search?q=atorvastatin', label: 'Cholesterol' },
  { href: '/search?q=cetirizine', label: 'Allergy' },
  { href: '/search?q=vitamin%20d3', label: 'Vitamins' },
  { href: '/about', label: 'How it works' },
];

export function Header() {
  const { location } = useLocation();
  const { items } = useCart();
  const dlg = useRef<LocationDialogHandle>(null);
  const pathname = usePathname();

  useEffect(() => {
    const open = () => dlg.current?.open();
    window.addEventListener('medcompare:open-location', open);
    return () => window.removeEventListener('medcompare:open-location', open);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <Logo />
        <button
          type="button"
          onClick={() => dlg.current?.open()}
          className="hidden h-10 min-w-0 items-center gap-2 rounded-lg px-2 text-left transition hover:bg-surface-2 md:flex"
          aria-label={`Delivery location ${location?.city ?? ''} ${location?.pin ?? ''}. Change`}
        >
          <Icon name="pin" className="size-5 text-brand" />
          <span className="leading-tight">
            <span className="block text-[11px] text-ink-3">Deliver to</span>
            <span className="flex items-center gap-1 text-[13.5px] font-semibold">{location ? `${location.city} ${location.pin}` : 'Select location'}<Icon name="chevron" className="size-3.5 text-ink-3" /></span>
          </span>
        </button>
        <div className={cx('hidden min-w-0 flex-1 md:block', pathname === '/' && 'md:invisible')}>
          {pathname !== '/' && <Suspense><SearchBox size="sm" /></Suspense>}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1 md:ml-0">
          <button type="button" onClick={() => dlg.current?.open()} className="flex h-9 min-w-0 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-2 md:hidden" aria-label="Change location">
            <Icon name="pin" className="size-4 text-brand" /><span className="max-w-[4.5rem] truncate whitespace-nowrap min-[400px]:max-w-[5.5rem]">{location?.city ?? 'Location'}</span>
          </button>
          <ThemeSwitch />
          <Link href="/cart" className="relative flex h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-sm sm:px-3 font-semibold text-ink-2 transition hover:bg-surface-2" aria-label={`Cart, ${items.length} items`}>
            <Icon name="cart" className="size-5" />
            <span className="hidden sm:inline">Cart</span>
            {items.length > 0 && <span className="num grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[11px] font-bold leading-[18px] text-on-brand max-sm:absolute max-sm:left-6 max-sm:top-1">{items.length}</span>}
          </Link>
        </div>
      </div>
      {pathname !== '/' && <div className="px-4 pb-3 md:hidden"><Suspense><SearchBox size="sm" /></Suspense></div>}
      <nav aria-label="Categories" className="hidden border-t border-line md:block">
        <ul className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {NAV.map((n) => {
            const active = n.href === pathname;
            return (
              <li key={n.href}>
                <Link prefetch={false} href={n.href} className={cx('relative block whitespace-nowrap px-3 py-2.5 text-[13.5px] font-medium transition', active ? 'text-brand' : 'text-ink-2 hover:text-ink')}>
                  {n.label}
                  {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <LocationDialog ref={dlg} />
    </header>
  );
}
