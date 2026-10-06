import { describe, expect, it } from 'vitest';
import { compositionKey, findSubstitutes, groupListings, nameKey, relevance } from './match';
import { discountPct, formatRupees, isPlaceholderImage, parseForm, parsePack, parseStrengths, perUnitPaise, toPaise } from './parse';
import type { Listing } from './types';

describe('toPaise', () => {
  it.each([
    ['₹32.28', 3228],
    ['32.12', 3212],
    [28.3, 2830],
    ['₹1,234.50', 123450],
    ['Rs. 15', 1500],
  ])('%s → %i', (v, p) => expect(toPaise(v)).toBe(p));
  it.each([null, undefined, '', '0', 0, -5, 'abc'])('%s → undefined', (v) => expect(toPaise(v)).toBeUndefined());
});

describe('parsePack', () => {
  it.each([
    ['15 tablets', 15, 'tab'],
    ['strip of 10 tablets', 10, 'tab'],
    ["Dolo-650 Tablet 15's", 15, 'tab'],
    ['DOLO 650MG TAB 1X15', 15, 'tab'],
    ['Dolo 650mg Tablet 15s', 15, 'tab'],
    ['Dolo Tablet (650mg) (15tab)', 15, 'tab'],
    ['60 ml oral suspension', 60, 'ml'],
    ['1 BOTTLE(s) OF 100ML', 100, 'ml'],
    ['bottle of 15 ml drop', 15, 'ml'],
    ['10 capsules', 10, 'cap'],
  ])('%s → %i %s', (t, units, unitType) => expect(parsePack(t)).toEqual({ units, unitType }));
  it('does not mistake strength for pack', () => expect(parsePack('Dolo 650 Tablet')).toBeUndefined());
});

describe('parseStrengths', () => {
  it('normalizes units', () => {
    expect(parseStrengths('Paracetamol 650mg')).toEqual(['650mg']);
    expect(parseStrengths('Amoxycillin 500 mg + Clavulanic Acid 125mg')).toEqual(['125mg', '500mg']);
    expect(parseStrengths('0.5 g')).toEqual(['500mg']);
    expect(parseStrengths('Fevago 100mg/ml Drop 15 ml')).toEqual(['100mg/ml']);
  });
});

describe('parseForm', () => {
  it.each([
    ['DOLO 650MG TAB', 'tablet'],
    ['Crocin 120 Oral Suspension', 'suspension'],
    ['Dolo IVG 1000mg Infusion', 'injection'],
    ['Azee 500 Capsule', 'capsule'],
  ])('%s → %s', (t, f) => expect(parseForm(t)).toBe(f));
});

describe('pricing helpers', () => {
  it('per unit', () => expect(perUnitPaise({ pricePaise: 2830, units: 15 })).toBeCloseTo(188.67, 1));
  it('no units → undefined', () => expect(perUnitPaise({ pricePaise: 2830 })).toBeUndefined());
  it('discount', () => expect(discountPct({ mrpPaise: 3228, pricePaise: 2830 })).toBe(12));
  it('format', () => {
    expect(formatRupees(2830)).toBe('₹28.30');
    expect(formatRupees(3200)).toBe('₹32');
    expect(formatRupees(undefined)).toBe('–');
  });
});

describe('nameKey merges the same medicine across pharmacies', () => {
  const names = [
    'Dolo 650 Tablet', // 1mg
    "Dolo-650 Tablet 15's", // Apollo
    'Dolo 650mg Tablet 15s', // PlatinumRx
    "DOLO 650MG TABLET 15'S", // Medkart
    'DOLO 650MG TAB', // MedPlus
    'Dolo Tablet (650mg) (15tab)', // Healthmug
    '<b>Dolo 650 Tablet</b>',
    'Dolo 650 Tablet 15', // Truemeds
    'Dolo 650Mg Strip Of 15 Tablets', // PharmEasy
  ];
  it.each(names)('%s → "650 dolo"', (n) => expect(nameKey(n)).toBe('650 dolo'));
  it('keeps different products apart', () => {
    expect(nameKey('Dolo 500 Tablet')).not.toBe(nameKey('Dolo 650 Tablet'));
    expect(nameKey('Dolo Xtraa Tablet')).not.toBe(nameKey('Dolo 650 Tablet'));
    expect(nameKey('Fevago 100mg/ml Drop')).toContain('100');
  });
});

describe('substitutes need matching strength', () => {
  it('salt without strength borrows it from the name, and never matches another strength', () => {
    const ls: Listing[] = [
      L({ source: 'netmeds', name: "Dolo 650 Tablet 15's", pricePaise: 2518, units: 15, unitType: 'tab', composition: 'Paracetamol', form: 'tablet' }),
      L({ source: 'netmeds', name: "Dolo-500 Tablet 15's", pricePaise: 930, units: 15, unitType: 'tab', composition: 'Paracetamol', form: 'tablet' }),
      L({ source: 'pharmeasy', name: 'Leemol 650Mg Strip Of 15 Tablets', pricePaise: 1674, units: 15, unitType: 'tab', composition: 'PARACETAMOL / ACETAMINOPHEN', form: 'tablet' }),
    ];
    const gs = groupListings(ls, 'dolo 650');
    const dolo = gs.find((g) => g.title.startsWith('Dolo 650'))!;
    expect(findSubstitutes(dolo, gs).map((g) => g.title)).toEqual(['Leemol 650Mg Strip Of 15 Tablets']);
  });
});

describe('compositionKey', () => {
  it('treats synonyms and formatting equally', () => {
    const k = 'paracetamol|650mg';
    expect(compositionKey('Paracetamol (Acetaminophen) 650mg')).toBe(k);
    expect(compositionKey('PARACETAMOL/ACETAMINOPHEN 650 MG')).toBe(k);
    expect(compositionKey('Paracetamol 650 MG')).toBe(k);
  });
  it('no strength → no key', () => expect(compositionKey('Paracetamol')).toBeUndefined());
  it('different strength → different key', () => expect(compositionKey('Paracetamol 500mg')).not.toBe(compositionKey('Paracetamol 650mg')));
  it('combination order does not matter', () =>
    expect(compositionKey('Amoxycillin 500mg + Clavulanic Acid 125mg')).toBe(compositionKey('Clavulanic Acid (125mg) + Amoxicillin (500mg)')));
});

const L = (o: Partial<Listing> & Pick<Listing, 'source' | 'name' | 'pricePaise'>): Listing => ({ id: o.name, url: '#', inStock: true, ...o });

describe('groupListings', () => {
  const listings: Listing[] = [
    L({ source: 'tata1mg', name: 'Dolo 650 Tablet', pricePaise: 2830, mrpPaise: 3228, units: 15, unitType: 'tab', form: 'tablet' }),
    L({ source: 'apollo', name: "Dolo-650 Tablet 15's", pricePaise: 3200, units: 15, unitType: 'tab' }),
    L({ source: 'platinumrx', name: 'Dolo 650mg Tablet 15s', pricePaise: 2634, units: 15, unitType: 'tab', composition: 'Paracetamol (Acetaminophen) 650mg', manufacturer: 'Micro Labs Ltd.', form: 'tablet' }),
    L({ source: 'medplus', name: 'DOLO 650MG TAB', pricePaise: 3228, units: 15, unitType: 'tab', inStock: false }),
    L({ source: 'tata1mg', name: 'Dolo 500 Tablet', pricePaise: 1500, units: 15, unitType: 'tab' }),
    L({ source: 'medkart', name: "PARACIP 650MG TABLET 15'S", pricePaise: 1200, units: 15, unitType: 'tab', composition: 'PARACETAMOL/ACETAMINOPHEN 650 MG', form: 'tablet' }),
  ];
  const groups = groupListings(listings, 'dolo 650');

  it('groups Dolo 650 from 4 pharmacies into one product', () => {
    const dolo = groups[0];
    expect(dolo?.title).toBe('Dolo 650 Tablet');
    expect(dolo?.offers.map((o) => o.source)).toEqual(['platinumrx', 'tata1mg', 'apollo', 'medplus']);
    expect(dolo?.best?.source).toBe('platinumrx');
    expect(dolo?.composition).toBe('Paracetamol (Acetaminophen) 650mg');
  });
  it('out-of-stock offers sort last', () => expect(groups[0]?.offers.at(-1)?.inStock).toBe(false));
  it('keeps Dolo 500 separate', () => expect(groups.find((g) => g.title === 'Dolo 500 Tablet')?.offers).toHaveLength(1));
  it('finds cheaper substitutes with the same composition', () => {
    const subs = findSubstitutes(groups[0]!, groups);
    expect(subs.map((s) => s.title)).toEqual(['Paracip 650mg Tablet 15\'s']);
  });
  it('relevance', () => {
    expect(relevance('dolo 650', listings[0]!)).toBe(1);
    expect(relevance('dolo 650', listings[4]!)).toBe(0.5);
    expect(relevance('paracetamol', listings[2]!)).toBe(1);
  });
});

describe('isPlaceholderImage', () => {
  it('flags generic "no photo" artwork from pharmacies', () => {
    expect(isPlaceholderImage(undefined)).toBe(true);
    expect(isPlaceholderImage('https://images.apollo247.in/pub/media/catalog/product/pharma/tablet.jpg')).toBe(true);
    expect(isPlaceholderImage('https://platinumrx.gumlet.io/meds-prescription/default_image.jpg')).toBe(true);
    expect(isPlaceholderImage('https://onemg.gumlet.io/a_ignore,w_380,h_380,c_fit,q_auto,f_auto/hx2gxivwmeoxxxsc1hix.png')).toBe(true);
    expect(isPlaceholderImage('https://www.healthmug.com/images/product/0_215.jpg')).toBe(true);
  });
  it('keeps real product photos', () => {
    expect(isPlaceholderImage('https://images.apollo247.in/pub/media/catalog/product/D/O/DOL0026_1_1.jpg')).toBe(false);
    expect(isPlaceholderImage('https://www.healthmug.com/images/product/108652-4.jpg')).toBe(false);
  });
});
