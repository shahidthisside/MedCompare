'use client';

import Link from 'next/link';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { unitPrice } from '@/lib/match';
import { formatRupees } from '@/lib/parse';
import { SOURCE_BY_ID } from '@/lib/sources/meta';
import type { ProductGroup } from '@/lib/types';
import { unitLabel } from './ProductCard';
import { Button, cx, Icon, PharmacyLogo, Thumb } from './ui';

export type AltTab = 'cheaper' | 'same';
export interface AlternativesDrawerHandle { open: (tab: AltTab) => void }

/** % cheaper per unit than the reference product (negative = dearer). */
export const savingPct = (g: ProductGroup, ref: ProductGroup) => Math.round((1 - unitPrice(g) / unitPrice(ref)) * 100);

/**
 * Side drawer (modal dialog) listing other brands with the same salt, strength and form.
 * Kept out of the results list so alternatives are never mistaken for the searched medicine.
 */
export const AlternativesDrawer = forwardRef<AlternativesDrawerHandle, { top: ProductGroup; cheaper: ProductGroup[]; others: ProductGroup[] }>(
  function AlternativesDrawer({ top, cheaper, others }, ref) {
    const dlg = useRef<HTMLDialogElement>(null);
    const body = useRef<HTMLDivElement>(null);
    const [tab, setTab] = useState<AltTab>('cheaper');
    useImperativeHandle(ref, () => ({
      open: (t) => { setTab(t === 'cheaper' && !cheaper.length ? 'same' : t); dlg.current?.showModal(); body.current?.scrollTo(0, 0); },
    }));
    const close = () => dlg.current?.close();
    const list = tab === 'cheaper' ? cheaper : others;
    const tabs: [AltTab, string, number][] = [['cheaper', 'Cheaper', cheaper.length], ['same', 'Same composition', others.length]];

    return (
      <dialog
        ref={dlg} aria-labelledby="alt-h"
        onClick={(e) => { if (e.target === dlg.current) close(); }}
        className="drawer fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(520px,100vw)] max-w-none border-l border-line bg-surface p-0 text-ink shadow-pop"
      >
        <div className="flex h-full flex-col">
          <header className="border-b border-line px-5 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Other brands, same composition</p>
                <h2 id="alt-h" className="mt-0.5 text-lg font-semibold leading-snug">Alternatives to {top.title}</h2>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"><Icon name="close" className="size-5" /></button>
            </div>
            <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px]">
              <p className="text-ink-3">You searched <span className="font-medium text-ink">{top.title}</span>, {top.best && <span className="num">{formatRupees(Math.round(unitPrice(top)), { decimals: 2 })}/{unitLabel(top.unitType)}</span>}</p>
              <p className="mt-0.5 text-ink-3">Composition: <span className="text-ink-2">{top.composition}</span>{top.form && <> · {top.form}</>}</p>
            </div>
            <div role="tablist" aria-label="Alternative medicines" className="mt-2 flex gap-1">
              {tabs.map(([id, label, n]) => (
                <button key={id} type="button" role="tab" id={`alt-tab-${id}`} aria-selected={tab === id} aria-controls="alt-list"
                  onClick={() => { setTab(id); body.current?.scrollTo(0, 0); }}
                  className={cx('-mb-px flex items-center gap-2 border-b-2 px-2 py-2.5 text-sm font-semibold transition', tab === id ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink-2')}>
                  {label}
                  <span className={cx('num rounded-full px-1.5 py-px text-[11px]', tab === id ? (id === 'cheaper' ? 'bg-ok-soft text-ok' : 'bg-brand-soft text-brand-strong') : 'bg-surface-2 text-ink-3')}>{n}</span>
                </button>
              ))}
            </div>
          </header>

          <div ref={body} id="alt-list" role="tabpanel" aria-labelledby={`alt-tab-${tab}`} className="flex-1 overflow-y-auto overscroll-contain">
            {list.length === 0 ? (
              <p className="px-5 py-8 text-sm text-ink-3">
                {tab === 'cheaper' ? `${top.title} is already the cheapest per ${unitLabel(top.unitType)} among these results.` : 'No other brands with this composition in these results.'}
              </p>
            ) : (
              <ul className="divide-y divide-line">{list.map((g) => <AltRow key={g.key} group={g} pct={savingPct(g, top)} onCompare={close} />)}</ul>
            )}
          </div>

          <p className="flex gap-2 border-t border-line bg-surface-2 px-5 py-3 text-xs text-ink-3"><Icon name="info" className="mt-px size-3.5 shrink-0" /> These are different brands. Consult your doctor or pharmacist before switching medicines.</p>
        </div>
      </dialog>
    );
  },
);

function AltRow({ group: g, pct, onCompare }: { group: ProductGroup; pct: number; onCompare: () => void }) {
  const best = g.best;
  if (!best) return null;
  const more = g.offers.length - 1;
  const highest = g.offers.at(-1)?.pricePaise ?? best.pricePaise;
  const pack = g.units ? `${g.units} ${unitLabel(g.unitType)}${g.units > 1 ? 's' : ''}` : undefined;
  return (
    <li className="px-5 py-4">
      <div className="flex gap-3">
        <Thumb src={g.imageUrl} alt={g.title} className="size-16" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium leading-snug">{g.title}</p>
            <div className="shrink-0 text-right">
              <p className="num font-semibold">{formatRupees(best.pricePaise)}</p>
              <p className="num text-xs text-ink-3">{formatRupees(Math.round(unitPrice(g)), { decimals: 2 })}/{unitLabel(g.unitType)}</p>
            </div>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-3">{[pack, g.manufacturer].filter(Boolean).join(' · ')}</p>
          {g.composition && <p className="mt-0.5 line-clamp-1 text-xs text-ink-3">{g.composition}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={cx('num rounded px-1.5 py-px text-[11px] font-semibold', pct > 0 ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-ink-3')}>
              {pct > 0 ? `${pct}% cheaper` : pct < 0 ? `${-pct}% costlier` : 'Same price'}
            </span>
            {g.rxRequired !== undefined && (
              <span className={cx('rounded px-1.5 py-px text-[11px] font-medium', g.rxRequired ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-3')}>{g.rxRequired ? 'Prescription required' : 'No prescription'}</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-xs text-ink-3">
              <span className="flex items-center gap-1.5 font-medium text-ink-2"><PharmacyLogo id={best.source} size={16} /> Cheapest at {SOURCE_BY_ID[best.source].name}</span>
              {more > 0 && <span className="num">+{more} more pharmac{more > 1 ? 'ies' : 'y'}, up to {formatRupees(highest)}</span>}
            </p>
            <div className="flex gap-2">
              <a href={best.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Buy ${g.title} on ${SOURCE_BY_ID[best.source].name}`}
                className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg bg-brand px-3 text-[13px] font-semibold text-on-brand hover:bg-brand-strong">
                Buy <Icon name="external" className="size-3.5" />
              </a>
              <Link href={`/search?q=${encodeURIComponent(g.title)}`} onClick={onCompare} className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-line-2 px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-2">
                Compare
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/** Compact sidebar card pointing to the best switch; short enough to stay sticky without inner scrolling. */
export function AlternativesTeaser({ top, cheaper, others, onOpen }: { top: ProductGroup; cheaper: ProductGroup[]; others: ProductGroup[]; onOpen: (t: AltTab) => void }) {
  const pick = cheaper[0];
  if (!pick?.best) {
    if (!others.length) return null;
    return (
      <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
        <h2 className="text-sm font-semibold">Other brands</h2>
        <p className="mt-1 text-sm text-ink-2">{top.title} is already the cheapest per {unitLabel(top.unitType)}. {others.length} other brand{others.length > 1 ? 's have' : ' has'} the same composition.</p>
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => onOpen('same')}>See same composition</Button>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-xl border border-ok-line bg-surface shadow-card">
      <div className="bg-ok-soft px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ok">Save up to {savingPct(pick, top)}%</p>
        <p className="mt-0.5 text-sm text-ink-2">Switch to a brand with the same composition.</p>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <Thumb src={pick.imageUrl} alt={pick.title} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{pick.title}</p>
          <p className="num flex items-center gap-1.5 text-xs text-ink-3"><PharmacyLogo id={pick.best.source} size={14} /> {formatRupees(Math.round(unitPrice(pick)), { decimals: 2 })}/{unitLabel(pick.unitType)} vs {formatRupees(Math.round(unitPrice(top)), { decimals: 2 })}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
        <Button size="sm" className="w-full" onClick={() => onOpen('cheaper')}>See {cheaper.length} cheaper alternative{cheaper.length > 1 ? 's' : ''}</Button>
        {others.length > 0 && <Button variant="ghost" size="sm" className="w-full" onClick={() => onOpen('same')}>{others.length} more with same composition</Button>}
      </div>
    </section>
  );
}

/** Prominent toolbar button for phones/tablets, where the sidebar teaser sits below all results. */
export function AlternativesButton({ top, cheaper, others, onOpen, className }: { top: ProductGroup; cheaper: ProductGroup[]; others: ProductGroup[]; onOpen: (t: AltTab) => void; className?: string }) {
  if (!cheaper.length && !others.length) return null;
  const pick = cheaper[0];
  return (
    <button
      type="button" onClick={() => onOpen(pick ? 'cheaper' : 'same')}
      className={cx('flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left shadow-card transition', pick ? 'border-ok-line bg-ok-soft hover:brightness-[0.98]' : 'border-line-2 bg-surface hover:bg-surface-2', className)}
    >
      <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', pick ? 'bg-ok text-white' : 'bg-brand-soft text-brand')}><Icon name="swap" className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm font-semibold', pick ? 'text-ok' : 'text-ink')}>
          {pick ? `See ${cheaper.length} cheaper alternative${cheaper.length > 1 ? 's' : ''}` : `See ${others.length} brand${others.length > 1 ? 's' : ''} with same composition`}
        </span>
        <span className="block truncate text-xs text-ink-3">{pick ? `Save up to ${savingPct(pick, top)}% · same composition as ${top.title}` : top.composition}</span>
      </span>
      <Icon name="chevronRight" className="size-4 shrink-0 text-ink-3" />
    </button>
  );
}
