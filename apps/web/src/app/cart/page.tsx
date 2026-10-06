'use client';

import Link from 'next/link';
import { Badge, Button, cx, Icon, PharmacyLogo, Thumb } from '@/components/ui';
import { offerCost, refUnits, useCart, useCartComparison } from '@/lib/cart';
import { formatRupees } from '@/lib/parse';
import { SOURCE_BY_ID } from '@/lib/sources/meta';

export default function CartPage() {
  const { items, remove, setQty, clear } = useCart();
  const cmp = useCartComparison();

  if (!items.length) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand"><Icon name="cart" className="size-7" /></span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Your cart is empty</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">Add the medicines on your prescription from the search results to see which pharmacy is cheapest for your whole order.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand hover:bg-brand-strong">Search medicines <Icon name="arrow" /></Link>
      </div>
    );
  }

  const best = cmp.bestSingle;
  const worst = cmp.perPharmacy.filter((p) => p.covered === items.length).at(-1);
  const splitSources = new Set(cmp.split.picks.map((p) => p.offer.source));
  const cost = (key: string, o: Parameters<typeof offerCost>[0]) => { const it = items.find((i) => i.key === key); return it ? offerCost(o, it) : o.pricePaise; };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Cart <span className="font-normal text-ink-3">({items.length} item{items.length > 1 ? 's' : ''})</span></h1>
        <Button variant="ghost" size="sm" onClick={clear}><Icon name="trash" /> Clear cart</Button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <ul className="divide-y divide-line">
              {items.map((it) => (
                <li key={it.key} className="flex items-center gap-3 p-4 sm:gap-4">
                  <Thumb src={it.imageUrl} alt={it.title} className="size-12 sm:size-16" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold leading-snug sm:truncate">{it.title}</p>
                    <p className="truncate text-[13px] text-ink-3">{refUnits(it.offers) ? `Pack of ${refUnits(it.offers)} · ` : ''}{it.subtitle ?? `${it.offers.length} pharmacies`}</p>
                  </div>
                  <div className="flex items-center rounded-lg border border-line-2">
                    <button type="button" aria-label={`Decrease ${it.title}`} onClick={() => setQty(it.key, it.qty - 1)} className="grid size-8 place-items-center text-ink-2 hover:bg-surface-2"><Icon name="minus" /></button>
                    <span className="num w-8 border-x border-line-2 text-center text-sm font-semibold leading-8" aria-live="polite">{it.qty}</span>
                    <button type="button" aria-label={`Increase ${it.title}`} onClick={() => setQty(it.key, it.qty + 1)} className="grid size-8 place-items-center text-ink-2 hover:bg-surface-2"><Icon name="plus" /></button>
                  </div>
                  <button type="button" aria-label={`Remove ${it.title}`} onClick={() => remove(it.key)} className="grid size-8 place-items-center rounded-lg text-ink-4 hover:bg-bad-soft hover:text-bad"><Icon name="trash" /></button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="matrix-h" className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="border-b border-line px-5 py-4">
              <h2 id="matrix-h" className="text-base font-semibold">Order total by pharmacy</h2>
              <p className="text-[13px] text-ink-3">Prices normalised to the same pack size. Delivery charges not included.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-surface-2 text-left text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="px-5 py-2 font-medium">Pharmacy</th>
                    {items.map((it) => <th key={it.key} scope="col" className="max-w-[10rem] truncate px-3 py-2 text-right font-medium" title={it.title}>{it.title}</th>)}
                    <th scope="col" className="px-5 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {cmp.perPharmacy.map((p) => {
                    const isBest = best?.source === p.source;
                    return (
                      <tr key={p.source} className={cx(isBest && 'bg-ok-soft/60')}>
                        <th scope="row" className="px-5 py-3 text-left font-medium"><span className="flex items-center gap-2"><PharmacyLogo id={p.source} size={22} />{SOURCE_BY_ID[p.source].name}{isBest && <Badge tone="ok">Cheapest</Badge>}</span></th>
                        {items.map((it) => {
                          const o = it.offers.find((x) => x.source === p.source);
                          return <td key={it.key} className="num px-3 py-3 text-right">{o?.inStock ? <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="text-ink-2 hover:text-brand hover:underline">{formatRupees(offerCost(o, it))}</a> : <span className="text-xs text-ink-4">{o ? 'Out of stock' : 'Not listed'}</span>}</td>;
                        })}
                        <td className="num px-5 py-3 text-right">
                          <span className={cx('font-semibold', isBest ? 'text-ok' : 'text-ink')}>{formatRupees(p.totalPaise)}</span>
                          {p.missing.length > 0 && <span className="block text-xs text-warn">{p.missing.length} item{p.missing.length > 1 ? 's' : ''} missing</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <h2 className="text-sm font-semibold text-ink-3">Best single pharmacy</h2>
            {best ? (
              <>
                <p className="mt-3 flex items-center gap-2.5 text-base font-semibold"><PharmacyLogo id={best.source} size={32} />{SOURCE_BY_ID[best.source].name}</p>
                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                  <span className="text-sm text-ink-3">Order total</span>
                  <span className="num text-2xl font-bold">{formatRupees(best.totalPaise)}</span>
                </div>
                {worst && worst.source !== best.source && (
                  <p className="mt-2 flex items-center justify-between rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok"><span>You save vs {SOURCE_BY_ID[worst.source].short}</span><span className="num font-semibold">{formatRupees(worst.totalPaise - best.totalPaise)}</span></p>
                )}
                <a href={SOURCE_BY_ID[best.source].site} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-11 items-center justify-center gap-1.5 rounded-lg bg-brand text-sm font-semibold text-on-brand transition hover:bg-brand-strong">Continue on {SOURCE_BY_ID[best.source].short} <Icon name="external" /></a>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-3">No single pharmacy has every item in stock. See the split order below.</p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink-3">Cheapest split order</h2>
              <span className="num text-lg font-bold">{formatRupees(cmp.split.totalPaise)}</span>
            </div>
            <p className="mt-1 text-xs text-ink-3">From {splitSources.size} pharmac{splitSources.size === 1 ? 'y' : 'ies'}{best && best.totalPaise > cmp.split.totalPaise ? ` · ${formatRupees(best.totalPaise - cmp.split.totalPaise)} less than a single order` : ''}</p>
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {cmp.split.picks.map((p) => (
                <li key={p.key}>
                  <a href={p.offer.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2.5 py-2.5 text-sm hover:text-brand">
                    <PharmacyLogo id={p.offer.source} size={20} />
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <span className="num font-semibold">{formatRupees(cost(p.key, p.offer))}</span>
                  </a>
                </li>
              ))}
              {cmp.split.missing.map((m) => <li key={m} className="py-2.5 text-sm text-warn">{m}: out of stock everywhere</li>)}
            </ul>
          </section>
          <p className="px-1 text-xs text-ink-4">Cart prices come from your most recent search. Search an item again to refresh its prices.</p>
        </aside>
      </div>
    </div>
  );
}
