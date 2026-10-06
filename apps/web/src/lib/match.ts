// Groups listings from different pharmacies into the same medicine and finds substitutes.
// Precision over recall: two listings only merge when brand words, strength numbers and form agree.

import { brandToken, parseForm, parseRelease, parseStrengths, perUnitPaise, stripHtml } from './parse';
import type { Listing, ProductGroup } from './types';

const FORM_WORDS = /\b(tablets?|tabs?|capsules?|caps?|syrup|syp|suspension|susp|injection|inj|infusion|drops?|cream|gel|ointment|spray|lotion|solution|sachet|powder|strip|bottle|vial|tube|oral|of|the|and|for|with|pack|in|new)\b/g;
const SALT_SYNONYMS: Record<string, string> = {
  acetaminophen: 'paracetamol',
  amoxycillin: 'amoxicillin',
  frusemide: 'furosemide',
  salbutamol: 'albuterol',
  levothyroxine: 'thyroxine',
  cholecalciferol: 'vitamin d3',
};
const SALT_STOP = new Set(['ip', 'bp', 'usp', 'mg', 'mcg', 'ml', 'gm', 'iu', 'w', 'v', 'and', 'with', 'as', 'eq', 'equivalent', 'to', 'of']);

/** Canonical name key: "Dolo-650 Tablet 15's" and "DOLO 650MG TAB 1X15" → "650 dolo". */
export function nameKey(name: string): string {
  let t = stripHtml(name).toLowerCase();
  t = t
    .replace(/\(\s*\d+\s*(tab|cap)s?\s*\)/g, ' ') // (15tab)
    .replace(/\b1\s*x\s*\d+\b/g, ' ') // 1X15
    .replace(/\b\d+\s*['’]\s*s\b/g, ' ') // 15's
    .replace(/\b(tablets?|tabs?|capsules?|caps?)\s+\d+s\b/g, '$1') // Tablet 15s
    .replace(/\b(tablets?|tabs?|capsules?|caps?)\s+\d+\s*$/g, '$1') // Truemeds: "Dolo 650 Tablet 15"
    .replace(/\bstrip of \d+\b/g, ' ')
    .replace(/\b\d+\s*(tablets|capsules)\b/g, ' ') // "15 tablets" (plural = pack count)
    .replace(/(\d+(?:\.\d+)?)\s*(ml|gm|g)\b(?!\s*\/)/g, ' ') // pack volume 60ml (not 100mg/ml)
    .replace(/(\d+(?:\.\d+)?)\s*(mg|mcg|iu)\b/g, '$1') // 650mg → 650
    .replace(FORM_WORDS, ' ')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(^|\s)\.+|\.+(\s|$)/g, ' ');
  const tokens = [...new Set(t.split(/\s+/).filter(Boolean))];
  return tokens.sort().join(' ');
}

/** Composition key: "Paracetamol (Acetaminophen) 650mg" and "PARACETAMOL/ACETAMINOPHEN 650 MG" → "paracetamol|650mg". */
export function compositionKey(composition: string | undefined): string | undefined {
  if (!composition) return undefined;
  let t = composition.toLowerCase();
  for (const [a, b] of Object.entries(SALT_SYNONYMS)) t = t.replaceAll(a, b);
  const strengths = parseStrengths(t);
  const words = [
    ...new Set(
      t
        .replace(/\d+(\.\d+)?/g, ' ')
        .replace(/[^a-z ]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1 && !SALT_STOP.has(w)),
    ),
  ].sort();
  if (!words.length || !strengths.length) return undefined; // without strength, "Paracetamol" would match 500mg and 650mg alike
  return `${words.join(' ')}|${strengths.join('+')}`;
}

function formFamily(l: Listing): string | undefined {
  const f = l.form ?? parseForm(l.name, l.packLabel);
  if (f === 'capsule') return 'tablet'; // tablets and capsules of same brand+strength are rare duplicates; keep together
  return f;
}

/** Relevance of a listing to the query: share of query tokens found (prefix match) in name/composition. */
export function relevance(query: string, l: Listing): number {
  const q = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  if (!q.length) return 0;
  const hay = `${stripHtml(l.name)} ${l.composition ?? ''}`.toLowerCase().replace(/(\d)\s*(mg|mcg|ml)/g, '$1');
  const words = hay.split(/[^a-z0-9]+/);
  const hit = q.filter((t) => words.some((w) => w.startsWith(t)));
  return hit.length / q.length;
}

export function groupListings(listings: Listing[], query = ''): ProductGroup[] {
  const groups = new Map<string, Listing[]>();
  const keyOf = (l: Listing) => `${nameKey(l.name)}#${formFamily(l) ?? '?'}#${parseRelease(l.name) ?? ''}`;
  for (const l of listings) {
    const k = keyOf(l);
    if (!k.startsWith('#')) groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  // Merge form-unknown groups into the single matching group with a known form.
  for (const k of [...groups.keys()]) {
    if (!k.includes('#?#')) continue;
    const prefix = k.split('#')[0];
    const rel = k.split('#')[2];
    const targets = [...groups.keys()].filter((o) => o !== k && o.split('#')[0] === prefix && o.split('#')[2] === rel);
    if (targets.length === 1) {
      const t = targets[0] as string;
      groups.set(t, [...(groups.get(t) ?? []), ...(groups.get(k) ?? [])]);
      groups.delete(k);
    }
  }

  const out: ProductGroup[] = [];
  for (const [key, ls] of groups) {
    // One offer per source: keep that source's cheapest per-unit in-stock row.
    const bySource = new Map<string, Listing>();
    for (const l of ls) {
      const cur = bySource.get(l.source);
      if (!cur || compareOffers(l, cur) < 0) bySource.set(l.source, l);
    }
    const offers = [...bySource.values()].sort(compareOffers);
    const pick = <K extends keyof Listing>(k: K) => offers.map((o) => o[k]).find((v) => v !== undefined && v !== '') as Listing[K] | undefined;
    const best = offers.find((o) => o.inStock) ?? offers[0];
    // Prefer the cleanest product names for the title.
    const titleSource = TITLE_PREFERENCE.map((s) => offers.find((o) => o.source === s)).find(Boolean) ?? offers[0];
    out.push({
      key,
      title: tidyTitle(titleSource?.name ?? ''),
      composition: tidyText(bestText(offers.map((o) => o.composition))),
      manufacturer: tidyText(bestText(offers.map((o) => o.manufacturer))),
      form: offers.map(formFamily).find(Boolean),
      strength: parseStrengths(`${pick('composition') ?? ''} ${titleSource?.name ?? ''}`).join(' + ') || undefined,
      units: best?.units,
      unitType: best?.unitType,
      imageUrl: IMAGE_PREFERENCE.map((src) => offers.find((o) => o.source === src)?.imageUrl).find(Boolean),
      rxRequired: offers.some((o) => o.rxRequired),
      offers,
      best,
      relevance: Math.max(...offers.map((o) => relevance(query, o))) + Math.min(offers.length, 7) * 0.04,
    });
  }
  return out.sort((a, b) => b.relevance - a.relevance || (a.best?.pricePaise ?? 0) - (b.best?.pricePaise ?? 0));
}

/** Cheapest first: in-stock before out-of-stock, then per-unit price (fallback pack price). */
export function compareOffers(a: Listing, b: Listing): number {
  if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
  const pa = perUnitPaise(a) ?? a.pricePaise;
  const pb = perUnitPaise(b) ?? b.pricePaise;
  return pa - pb;
}

/** Other groups with the same composition and form, cheaper per unit first. */
/** Composition key for a group; borrows the strength from the product name when the salt text has none. */
export function groupCompositionKey(g: Pick<ProductGroup, 'composition' | 'title' | 'offers'>): string | undefined {
  const texts = [g.composition, ...g.offers.map((o) => o.composition)].filter((x): x is string => Boolean(x));
  for (const t of texts) { const k = compositionKey(t); if (k) return k; }
  let nameStrength = parseStrengths(g.title);
  if (!nameStrength.length) {
    // "Dolo 650 Tablet" / "Pan 40": a lone number in a tablet/capsule brand name is its strength in mg.
    const nums = nameKey(g.title).split(' ').filter((t) => /^\d+(\.\d+)?$/.test(t) && Number(t) > 0 && Number(t) <= 2000);
    if (nums.length === 1 && g.offers.some((o) => o.unitType === 'tab' || o.unitType === 'cap')) nameStrength = [`${nums[0]}mg`];
  }
  const first = texts[0];
  // Only borrow for single-salt products, where the name's strength must be that salt's.
  if (first && nameStrength.length === 1 && !/[+,/]|\band\b/i.test(first.replace(/\(.*?\)|\/\s*acetaminophen/gi, ''))) return compositionKey(`${first} ${nameStrength[0]}`);
  return undefined;
}

export function findSubstitutes(group: ProductGroup, all: ProductGroup[]): ProductGroup[] {
  const ck = groupCompositionKey(group);
  if (!ck) return [];
  return all
    .filter((g) => g.key !== group.key && groupCompositionKey(g) === ck && g.form === group.form && g.best)
    .sort((a, b) => unitPrice(a) - unitPrice(b));
}

export function unitPrice(g: ProductGroup): number {
  return g.best ? (perUnitPaise(g.best) ?? g.best.pricePaise) : Number.POSITIVE_INFINITY;
}

// Image CDNs ordered by reliability (PlatinumRx hero images sometimes 404).
const IMAGE_PREFERENCE = ['tata1mg', 'apollo', 'medplus', 'medkart', 'mrmed', 'healthmug', 'netmeds', 'pharmeasy', 'truemeds', 'platinumrx'] as const;
/** Prefer text with a strength in it, then mixed case, then longest. */
function bestText(xs: (string | undefined)[]): string | undefined {
  const c = xs.filter((x): x is string => Boolean(x && x.trim()));
  const score = (x: string) => (parseStrengths(x).length ? 4 : 0) + (x !== x.toUpperCase() ? 2 : 0) + Math.min(x.length, 60) / 100;
  return c.sort((a, b) => score(b) - score(a))[0];
}
function tidyText(x: string | undefined): string | undefined {
  if (!x) return x;
  return x === x.toUpperCase() ? x.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, p: string, ch: string) => p + ch.toUpperCase()).replace(/(\d)\s*Mg\b/g, '$1 mg') : x;
}

const TITLE_PREFERENCE = ['tata1mg', 'apollo', 'platinumrx', 'healthmug', 'mrmed', 'medkart', 'medplus'] as const;

function tidyTitle(name: string): string {
  const s = stripHtml(name).replace(/\s*\|.*$/, '');
  // ALL-CAPS names (Medkart/MedPlus) → Title Case
  return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (_, p, c) => p + c.toUpperCase()) : s;
}

export { brandToken };
