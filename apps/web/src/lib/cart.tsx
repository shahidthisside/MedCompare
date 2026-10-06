'use client';
// Compare cart: medicines the user plans to buy, compared as a basket across pharmacies. Persisted in localStorage.

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Listing, ProductGroup, SourceId } from './types';

export interface CartItem {
  key: string; // ProductGroup key
  title: string;
  subtitle?: string;
  imageUrl?: string;
  qty: number; // packs
  offers: Listing[]; // snapshot of offers when added (refreshed when re-searched)
  addedAt: string;
}

const KEY = 'medcompare:cart';

interface CartCtx {
  items: CartItem[];
  add: (g: ProductGroup) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  has: (key: string) => boolean;
  clear: () => void;
  updateOffers: (g: ProductGroup) => void;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem(KEY) ?? '[]') as CartItem[]); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(items)); }, [items, ready]);

  const add = useCallback((g: ProductGroup) => {
    setItems((xs) => (xs.some((x) => x.key === g.key) ? xs : [...xs, { key: g.key, title: g.title, subtitle: g.composition ?? g.manufacturer, imageUrl: g.imageUrl, qty: 1, offers: g.offers, addedAt: new Date().toISOString() }]));
  }, []);
  const remove = useCallback((key: string) => setItems((xs) => xs.filter((x) => x.key !== key)), []);
  const setQty = useCallback((key: string, qty: number) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, qty: Math.max(1, Math.min(20, qty)) } : x))), []);
  const clear = useCallback(() => setItems([]), []);
  const updateOffers = useCallback((g: ProductGroup) => setItems((xs) => xs.map((x) => (x.key === g.key ? { ...x, offers: g.offers } : x))), []);
  const has = useCallback((key: string) => items.some((x) => x.key === key), [items]);

  return <Ctx.Provider value={{ items, add, remove, setQty, has, clear, updateOffers }}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}

// ---------- Basket optimisation (pure, tested) ----------

export interface PharmacyTotal {
  source: SourceId;
  totalPaise: number;
  covered: number; // items available here (in stock)
  missing: string[]; // item titles not available
}

export interface CartComparison {
  perPharmacy: PharmacyTotal[]; // complete baskets first, then by total
  split: { totalPaise: number; picks: { key: string; title: string; offer: Listing }[]; missing: string[] };
  bestSingle?: PharmacyTotal;
}

/** Reference pack size for an item: the most common unit count among its offers. */
export function refUnits(offers: Listing[]): number | undefined {
  const counts = new Map<number, number>();
  for (const o of offers) if (o.units) counts.set(o.units, (counts.get(o.units) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
}

/** Cost of `qty` reference packs bought from this offer, normalized by per-unit price (pack sizes differ across pharmacies). */
export function offerCost(o: Listing, it: Pick<CartItem, 'qty' | 'offers'>): number {
  const ref = refUnits(it.offers);
  if (!ref || !o.units || o.units === ref) return o.pricePaise * it.qty;
  return Math.round((o.pricePaise / o.units) * ref * it.qty);
}

export function compareCart(items: Pick<CartItem, 'key' | 'title' | 'qty' | 'offers'>[]): CartComparison {
  const sources = new Set<SourceId>(items.flatMap((i) => i.offers.map((o) => o.source)));
  const perPharmacy: PharmacyTotal[] = [...sources].map((source) => {
    let totalPaise = 0;
    const missing: string[] = [];
    for (const it of items) {
      const o = it.offers.find((x) => x.source === source && x.inStock);
      if (o) totalPaise += offerCost(o, it);
      else missing.push(it.title);
    }
    return { source, totalPaise, covered: items.length - missing.length, missing };
  });
  perPharmacy.sort((a, b) => b.covered - a.covered || a.totalPaise - b.totalPaise);

  const picks: CartComparison['split']['picks'] = [];
  const missing: string[] = [];
  for (const it of items) {
    const best = it.offers.filter((o) => o.inStock).sort((a, b) => offerCost(a, it) - offerCost(b, it))[0];
    if (best) picks.push({ key: it.key, title: it.title, offer: best });
    else missing.push(it.title);
  }
  const split = { totalPaise: picks.reduce((sum, p) => { const it = items.find((i) => i.key === p.key); return sum + (it ? offerCost(p.offer, it) : p.offer.pricePaise); }, 0), picks, missing };
  const bestSingle = perPharmacy.find((p) => p.covered === items.length);
  return { perPharmacy, split, bestSingle };
}

export function useCartComparison(): CartComparison {
  const { items } = useCart();
  return useMemo(() => compareCart(items), [items]);
}
