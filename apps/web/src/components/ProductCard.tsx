'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart';
import { discountPct, formatRupees, perUnitPaise } from '@/lib/parse';
import { SOURCE_BY_ID } from '@/lib/sources/meta';
import type { Listing, ProductGroup } from '@/lib/types';
import { Badge, Button, cx, Icon, PharmacyLogo, Thumb } from './ui';

const UNIT: Record<string, string> = { tab: 'tablet', cap: 'capsule', ml: 'ml', g: 'g', unit: 'unit' };
export const unitLabel = (u?: Listing['unitType']) => (u ? UNIT[u] ?? 'unit' : 'unit');
export function perUnitText(l: Listing): string | undefined {
  const p = perUnitPaise(l);
  return p === undefined || !l.units || l.units <= 1 ? undefined : `${formatRupees(Math.round(p), { decimals: 2 })}/${unitLabel(l.unitType)}`;
}
const packText = (g: ProductGroup) => (g.units ? `${g.unitType === 'ml' || g.unitType === 'g' ? 'Pack of' : 'Strip of'} ${g.units} ${unitLabel(g.unitType)}${g.units > 1 && g.unitType !== 'ml' && g.unitType !== 'g' ? 's' : ''}` : undefined);
const ppu = (l: Listing) => perUnitPaise(l) ?? l.pricePaise;

export function ProductCard({ group, expanded = false, cheaperSubs = 0, onShowSubs }: { group: ProductGroup; expanded?: boolean; cheaperSubs?: number; onShowSubs?: () => void }) {
  const [open, setOpen] = useState(expanded);
  const cart = useCart();
  const inCart = cart.has(group.key);
  const best = group.best;
  const stocked = group.offers.filter((o) => o.inStock);
  const worst = stocked.length > 1 ? stocked[stocked.length - 1] : undefined;
  const savePct = best && worst ? Math.round((1 - ppu(best) / ppu(worst)) * 100) : 0;
  const shown = open ? group.offers : group.offers.slice(0, 3);
  const d = best ? discountPct(best) : 0;

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex gap-4 p-4 sm:p-5">
        <Thumb src={group.imageUrl} alt={group.title} className="size-20 sm:size-24" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug sm:text-[17px]">{group.title}</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">{packText(group) ?? group.form}</p>
          {group.composition && <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-2 sm:line-clamp-1"><span className="text-ink-3">Composition: </span>{group.composition}</p>}
          {group.manufacturer && <p className="line-clamp-1 text-[13px] text-ink-2"><span className="text-ink-3">Manufacturer: </span>{group.manufacturer}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.rxRequired && <Badge tone="warn">Prescription required</Badge>}
            <Badge tone="gray">{group.offers.length} pharmac{group.offers.length > 1 ? 'ies' : 'y'}</Badge>
            {savePct > 0 && <Badge tone="ok">Save up to {savePct}%</Badge>}
          </div>
        </div>
        {best && (
          <div className="hidden w-44 shrink-0 border-l border-line pl-5 sm:block">
            <p className="text-xs font-medium text-ink-3">Lowest price</p>
            <p className="num mt-0.5 text-2xl font-bold tracking-tight">{formatRupees(best.pricePaise)}</p>
            {best.mrpPaise && d > 0 && <p className="num text-[13px] text-ink-3"><s>{formatRupees(best.mrpPaise)}</s> <span className="font-semibold text-ok">{d}% off</span></p>}
            {perUnitText(best) && <p className="num mt-0.5 text-[13px] text-ink-2">{perUnitText(best)}</p>}
            <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-2"><PharmacyLogo id={best.source} size={18} />{SOURCE_BY_ID[best.source].name}</p>
          </div>
        )}
      </div>

      {best && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 sm:hidden">
          <span className="flex items-center gap-1.5 text-[13px] text-ink-3"><PharmacyLogo id={best.source} size={18} />Lowest at {SOURCE_BY_ID[best.source].short}</span>
          <span className="text-right"><span className="num block text-lg font-bold">{formatRupees(best.pricePaise)}</span>{perUnitText(best) && <span className="num block text-xs text-ink-3">{perUnitText(best)}</span>}</span>
        </div>
      )}

      {/* Offers table */}
      <div className="border-t border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">Prices for {group.title}, cheapest per unit first</caption>
          <thead className="hidden bg-surface-2 text-left text-xs font-medium text-ink-3 sm:table-header-group">
            <tr>
              <th scope="col" className="px-5 py-2 font-medium">Pharmacy</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">MRP</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Per {unitLabel(group.unitType)}</th>
              <th scope="col" className="px-3 py-2 font-medium">Delivery</th>
              <th scope="col" className="px-5 py-2"><span className="sr-only">Buy</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((o, i) => <OfferRow key={`${o.source}-${o.id}`} offer={o} lowest={i === 0 && o.inStock} />)}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
        {group.offers.length > 3 && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand hover:text-brand-strong">
            {open ? 'Show fewer pharmacies' : `View all ${group.offers.length} pharmacies`} <Icon name="chevron" className={cx('size-4 transition', open && 'rotate-180')} />
          </button>
        )}
        {cheaperSubs > 0 && (
          <button type="button" onClick={onShowSubs} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ok hover:underline">
            <Icon name="swap" className="size-4" /> {cheaperSubs} cheaper alternative{cheaperSubs > 1 ? 's' : ''}
          </button>
        )}
        <Button variant={inCart ? 'secondary' : 'primary'} size="sm" className="ml-auto" onClick={() => (inCart ? cart.remove(group.key) : cart.add(group))} aria-pressed={inCart}>
          <Icon name={inCart ? 'check' : 'plus'} /> {inCart ? 'Added to cart' : 'Add to cart'}
        </Button>
      </div>
    </article>
  );
}

function OfferRow({ offer: o, lowest }: { offer: Listing; lowest: boolean }) {
  const d = discountPct(o);
  return (
    <tr className={cx('max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-3 max-sm:px-4 max-sm:py-2.5', lowest && 'bg-ok-soft/60 dark:bg-ok-soft', !o.inStock && 'text-ink-4')}>
      <td className="min-w-0 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <PharmacyLogo id={o.source} size={28} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium text-ink">{SOURCE_BY_ID[o.source].name}{lowest && <Badge tone="ok" className="max-sm:hidden">Lowest</Badge>}</p>
            <p className="truncate text-xs text-ink-3 sm:max-w-[16rem]" title={o.name}>{!o.inStock ? 'Out of stock' : o.name}</p>
          </div>
        </div>
      </td>
      <td className="num text-right sm:px-3 sm:py-3">
        <span className={cx('font-semibold', lowest ? 'text-ok' : 'text-ink')}>{formatRupees(o.pricePaise)}</span>
        <span className="block text-xs text-ink-3 sm:hidden">{perUnitText(o)}</span>
      </td>
      <td className="num text-right text-[13px] text-ink-3 max-sm:hidden sm:px-3">{o.mrpPaise && d > 0 ? <><s>{formatRupees(o.mrpPaise)}</s> <span className="font-semibold text-ok">{d}%</span></> : '—'}</td>
      <td className="num text-right text-[13px] text-ink-2 max-sm:hidden sm:px-3">{perUnitText(o) ?? '—'}</td>
      <td className="text-[13px] text-ink-3 max-sm:col-start-1 max-sm:row-start-2 max-sm:text-xs sm:px-3">{o.eta ? <span className="inline-flex items-center gap-1"><Icon name="truck" className="size-3.5" />{o.eta}</span> : <span className="max-sm:hidden">—</span>}</td>
      <td className="text-right max-sm:col-start-2 max-sm:row-start-2 sm:px-5">
        <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className={cx('inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold transition', lowest ? 'bg-brand text-on-brand hover:bg-brand-strong' : 'border border-line-2 text-ink-2 hover:bg-surface-2')}>
          Buy <Icon name="external" className="size-3.5" /><span className="sr-only"> at {SOURCE_BY_ID[o.source].name}</span>
        </a>
      </td>
    </tr>
  );
}

export function ProductSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5" aria-hidden>
      <div className="flex gap-4">
        <div className="skeleton size-24 rounded-lg" />
        <div className="flex-1 space-y-2.5 pt-1"><div className="skeleton h-4 w-2/3 rounded" /><div className="skeleton h-3 w-1/3 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div>
      </div>
      <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
    </div>
  );
}
