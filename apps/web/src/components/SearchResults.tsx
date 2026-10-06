'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/lib/cart';
import { useLocation } from '@/lib/location';
import { findSubstitutes, unitPrice } from '@/lib/match';
import { formatRupees } from '@/lib/parse';
import { SOURCE_BY_ID } from '@/lib/sources/meta';
import type { ProductGroup } from '@/lib/types';
import { useLiveSearch } from '@/lib/useLiveSearch';
import { useOpenLocation } from './Header';
import { type AltTab, AlternativesButton, AlternativesDrawer, type AlternativesDrawerHandle, AlternativesTeaser } from './Alternatives';
import { ProductCard, ProductSkeleton, unitLabel } from './ProductCard';
import { SourceStatus } from './SourceStatusBar';
import { cx, Icon } from './ui';

type Sort = 'match' | 'unit' | 'pack' | 'coverage';
const SORTS: [Sort, string][] = [['match', 'Relevance'], ['unit', 'Price per tablet: low to high'], ['pack', 'Pack price: low to high'], ['coverage', 'Most pharmacies']];

export function SearchResults({ query }: { query: string }) {
  const { location } = useLocation();
  const openLocation = useOpenLocation();
  const { states, groups, pending, refresh } = useLiveSearch(query, location);
  const { items, updateOffers } = useCart();
  const [sort, setSort] = useState<Sort>('match');
  const [stockOnly, setStockOnly] = useState(true);
  const [rx, setRx] = useState<'all' | 'otc' | 'rx'>('all');
  const [limit, setLimit] = useState(10);
  const drawerRef = useRef<AlternativesDrawerHandle>(null);
  const openAlternatives = (t: AltTab) => drawerRef.current?.open(t);
  useEffect(() => {
    if (pending) return;
    for (const g of groups) if (items.some((i) => i.key === g.key)) updateOffers(g);
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setLimit(10), [query]);

  const visible = useMemo(() => {
    const list = groups.filter((g) => (stockOnly ? g.offers.some((o) => o.inStock) : true) && g.relevance > 0.3 && (rx === 'all' || (rx === 'rx' ? g.rxRequired : !g.rxRequired)));
    const cmp: Record<Sort, (a: ProductGroup, b: ProductGroup) => number> = {
      match: () => 0,
      unit: (a, b) => unitPrice(a) - unitPrice(b),
      pack: (a, b) => (a.best?.pricePaise ?? Infinity) - (b.best?.pricePaise ?? Infinity),
      coverage: (a, b) => b.offers.length - a.offers.length,
    };
    return sort === 'match' ? list : [...list].sort(cmp[sort]);
  }, [groups, sort, stockOnly, rx]);

  const top = visible[0];
  const sameSalt = useMemo(() => (top ? findSubstitutes(top, groups) : []), [top, groups]);
  const subs = useMemo(() => (top ? sameSalt.filter((s) => unitPrice(s) < unitPrice(top)) : []), [top, sameSalt]);
  // Same salt, strength and form but not cheaper per unit than the top result.
  const otherBrands = useMemo(() => (top ? sameSalt.filter((s) => unitPrice(s) >= unitPrice(top)) : []), [top, sameSalt]);

  if (!query) return <p className="mx-auto max-w-7xl px-6 py-24 text-ink-3">Type a medicine name to compare prices.</p>;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-ink-3">
        <Link href="/" className="hover:text-ink">Home</Link><Icon name="chevronRight" className="size-3.5" /><span className="text-ink-2">Search</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Prices for “{query}”</h1>
        <p className="num text-sm text-ink-3" aria-live="polite">{visible.length} products from {SOURCES_ANSWERED(states)} pharmacies</p>
      </div>

      <div className="mt-4">{location && <SourceStatus states={states} pending={pending} location={location} onRefresh={refresh} onChangeLocation={openLocation} />}</div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {top?.composition && <AlternativesButton top={top} cheaper={subs} others={otherBrands} onOpen={openAlternatives} className="mb-3 lg:hidden" />}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-ink-3">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-lg border border-line-2 bg-surface px-2.5 text-sm font-medium text-ink shadow-card outline-none focus:border-brand">
                {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <div className="ml-auto flex flex-wrap gap-2">
              {([['otc', 'No prescription'], ['rx', 'Prescription']] as const).map(([id, label]) => (
                <FilterChip key={id} on={rx === id} onClick={() => setRx((v) => (v === id ? 'all' : id))}>{label}</FilterChip>
              ))}
              <FilterChip on={stockOnly} onClick={() => setStockOnly((v) => !v)}>In stock only</FilterChip>
            </div>
          </div>

          <div className="space-y-4">
            {visible.slice(0, limit).map((g, i) => (
              <ProductCard key={g.key} group={g} expanded={i === 0} cheaperSubs={i === 0 ? subs.length : 0} onShowSubs={() => openAlternatives('cheaper')} />
            ))}
            {pending > 0 && visible.length < 3 && [0, 1, 2].map((i) => <ProductSkeleton key={i} />)}
            {pending === 0 && visible.length === 0 && (
              <div className="rounded-xl border border-line bg-surface px-6 py-14 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-surface-2 text-ink-3"><Icon name="search" className="size-6" /></span>
                <p className="mt-4 text-lg font-semibold">No results for “{query}”</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-ink-3">Check the spelling, try the brand name without the strength, or search by salt name, e.g. “paracetamol”.</p>
              </div>
            )}
            {visible.length > limit && (
              <button type="button" onClick={() => setLimit((l) => l + 10)} className="w-full rounded-xl border border-line-2 bg-surface py-3 text-sm font-semibold text-ink-2 shadow-card transition hover:bg-surface-2">
                Load more products
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          {top?.composition && <AlternativesTeaser top={top} cheaper={subs} others={otherBrands} onOpen={openAlternatives} />}
          {top?.composition && <AlternativesDrawer ref={drawerRef} top={top} cheaper={subs} others={otherBrands} />}

          {top?.best && (
            <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <h2 className="text-sm font-semibold">Summary</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                {top.title} is cheapest at <span className="font-semibold text-ink">{SOURCE_BY_ID[top.best.source].name}</span> for <span className="num font-semibold text-ink">{formatRupees(top.best.pricePaise)}</span>
                {top.offers.length > 1 && <>, compared across {top.offers.length} pharmacies</>}.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function SOURCES_ANSWERED(states: ReturnType<typeof useLiveSearch>['states']) {
  return Object.values(states).filter((s) => s.status === 'done' && s.result.ok && s.result.listings.length).length;
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cx('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition', on ? 'border-brand-line bg-brand-soft text-brand-strong' : 'border-line-2 bg-surface text-ink-2 hover:bg-surface-2')}>
      {on && <Icon name="check" className="size-3.5" />}{children}
    </button>
  );
}

