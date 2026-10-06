import { describe, expect, it } from 'vitest';
import { compareCart } from './cart';
import type { Listing } from './types';

const o = (source: Listing['source'], pricePaise: number, inStock = true): Listing => ({ source, id: source, name: 'x', url: '#', pricePaise, inStock });

describe('compareCart', () => {
  const items = [
    { key: 'a', title: 'Dolo 650', qty: 2, offers: [o('tata1mg', 2830), o('apollo', 3200), o('platinumrx', 2634)] },
    { key: 'b', title: 'Pan 40', qty: 1, offers: [o('tata1mg', 18300), o('apollo', 19250), o('platinumrx', 15810, false)] },
  ];
  const c = compareCart(items);

  it('totals per pharmacy, complete baskets first', () => {
    expect(c.perPharmacy.map((p) => [p.source, p.totalPaise, p.covered])).toEqual([
      ['tata1mg', 2830 * 2 + 18300, 2],
      ['apollo', 3200 * 2 + 19250, 2],
      ['platinumrx', 2634 * 2, 1],
    ]);
    expect(c.perPharmacy[2]?.missing).toEqual(['Pan 40']);
  });
  it('best single pharmacy = cheapest complete basket', () => expect(c.bestSingle?.source).toBe('tata1mg'));
  it('split picks cheapest in-stock offer per item', () => {
    expect(c.split.picks.map((p) => p.offer.source)).toEqual(['platinumrx', 'tata1mg']);
    expect(c.split.totalPaise).toBe(2634 * 2 + 18300);
  });
  it('reports items with no stock anywhere', () => {
    const r = compareCart([{ key: 'z', title: 'Gone', qty: 1, offers: [o('apollo', 100, false)] }]);
    expect(r.split.missing).toEqual(['Gone']);
    expect(r.bestSingle).toBeUndefined();
  });

  it('normalizes different pack sizes by per-unit price', () => {
    const u = (source: Listing['source'], pricePaise: number, units: number): Listing => ({ ...o(source, pricePaise), units, unitType: 'tab' });
    const r = compareCart([{ key: 'd', title: 'Dolo', qty: 1, offers: [u('tata1mg', 2850, 15), u('apollo', 3200, 15), u('platinumrx', 1674, 10)] }]);
    // PlatinumRx: ₹16.74 for 10 → ₹25.11 for 15
    expect(r.split.picks[0]?.offer.source).toBe('platinumrx');
    expect(r.split.totalPaise).toBe(2511);
  });
});
