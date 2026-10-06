import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { groupListings } from '../match';
import type { Listing, SourceId } from '../types';
import { ADAPTERS, oneMgCity } from './adapters';

// Fixtures are real responses captured on 2026-10-06 for query "dolo 650".
const fixture = (id: SourceId) => JSON.parse(readFileSync(path.join(import.meta.dirname, '__fixtures__', `${id}.json`), 'utf8'));
const parsed = Object.fromEntries((Object.keys(ADAPTERS) as SourceId[]).map((id) => [id, ADAPTERS[id].parse(fixture(id), 'dolo 650')])) as Record<SourceId, Listing[]>;
const dolo = (id: SourceId) => parsed[id].find((l) => /^dolo\b.*\b650/i.test(l.name) && !/xtra|plus|duo|drop|syrup|susp/i.test(l.name));

describe.each(Object.keys(ADAPTERS) as SourceId[])('%s adapter', (id) => {
  it('parses listings with valid prices, names and links', () => {
    const ls = parsed[id];
    expect(ls.length).toBeGreaterThan(0);
    for (const l of ls) {
      expect(l.source).toBe(id);
      expect(l.name).not.toMatch(/<\/?b>/);
      expect(Number.isInteger(l.pricePaise)).toBe(true);
      expect(l.pricePaise).toBeGreaterThan(0);
      if (l.mrpPaise) expect(l.mrpPaise).toBeGreaterThanOrEqual(l.pricePaise);
      expect(l.url).toMatch(/^https:\/\//);
    }
  });
});

describe('Dolo 650 (15 tablets) parsed from each pharmacy', () => {
  // MrMed's fixture only contains Dolo 1000 infusion.
  it.each([
    ['tata1mg', 2830, 3228],
    ['apollo', 3200, 3200],
    ['platinumrx', 2634, 3212],
    ['medkart', 3067, 3228],
    ['healthmug', 3100, 3200],
    ['medplus', 3228, 3228],
    ['netmeds', 2518, 3228],
  ] as const)('%s price %i mrp %i, 15 tablets', (id, price, mrp) => {
    const l = dolo(id);
    expect(l, `no dolo 650 in ${id}`).toBeDefined();
    expect(l?.pricePaise).toBe(price);
    expect(l?.mrpPaise ?? l?.pricePaise).toBe(mrp);
    expect(l?.units).toBe(15);
    expect(['tab', 'unit']).toContain(l?.unitType);
  });

  it('rich fields where the API provides them', () => {
    expect(dolo('platinumrx')?.composition).toMatch(/paracetamol/i);
    expect(dolo('platinumrx')?.manufacturer).toMatch(/micro labs/i);
    expect(dolo('medkart')?.composition).toMatch(/paracetamol/i);
    expect(dolo('medplus')?.composition).toMatch(/paracetamol/i);
    expect(dolo('apollo')?.url).toBe('https://www.apollopharmacy.in/otc/dolo-650mg-tablet-15-s');
    expect(dolo('apollo')?.imageUrl).toBe('https://images.apollo247.in/pub/media/catalog/product/D/O/DOL0026_1_1.jpg');
    expect(dolo('platinumrx')?.url).toBe('https://www.platinumrx.in/otc/dolo-650mg-tablet-15s/1111190');
    expect(dolo('medkart')?.url).toBe('https://www.medkart.in/order-medicine/dolo-650mg-tablet-15s');
  });

  it('MrMed parses packing and molecule', () => {
    const l = parsed.mrmed.find((x) => /dolo 1000/i.test(x.name));
    expect(l?.units).toBe(100);
    expect(l?.unitType).toBe('ml');
    expect(l?.composition).toMatch(/paracetamol/i);
  });

  it('all six group into a single product', () => {
    const all = Object.values(parsed).flat();
    const groups = groupListings(all, 'dolo 650');
    const g = groups.find((x) => x.offers.some((o) => o === dolo('tata1mg')));
    expect(g?.offers.map((o) => o.source).sort()).toEqual(['apollo', 'healthmug', 'medkart', 'medplus', 'netmeds', 'pharmeasy', 'platinumrx', 'tata1mg', 'truemeds']);
  });
});

describe('new sources', () => {
  it('Truemeds: salt, manufacturer, pack, link', () => {
    const l = parsed.truemeds.find((x) => /dolo 650 tablet 15/i.test(x.name));
    expect(l?.units).toBe(15);
    expect(l?.composition).toMatch(/paracetamol/i);
    expect(l?.manufacturer).toMatch(/micro labs/i);
    expect(l?.url).toMatch(/^https:\/\/www\.truemeds\.in\/(otc|medicine)\//);
  });
  it('PharmEasy: price from product page data', () => {
    const l = dolo('pharmeasy');
    expect(l?.units).toBe(15);
    expect(l?.mrpPaise).toBe(3228);
    expect(l?.composition).toMatch(/paracetamol/i);
    expect(l?.url).toBe('https://pharmeasy.in/online-medicine-order/dolo-650mg-strip-of-15-tablets-44140');
  });
  it('Netmeds: generic name and pack', () => {
    const l = dolo('netmeds');
    expect(l?.composition).toBe('Paracetamol');
    expect(l?.url).toBe('https://www.netmeds.com/product/dolo-650-tablet-15s-lui1wb-8231049');
  });
});

describe('oneMgCity', () => {
  it.each([
    ['Gurugram', 'Gurgaon'],
    ['Bengaluru', 'Bangalore'],
    ['Delhi', 'New Delhi'],
    ['Mumbai Suburban', 'Mumbai'],
    ['lucknow', 'Lucknow'],
  ])('%s → %s', (a, b) => expect(oneMgCity(a)).toBe(b));
});
