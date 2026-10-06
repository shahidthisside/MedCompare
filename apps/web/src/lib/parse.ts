// Pure parsing helpers: prices, pack sizes, strengths, forms, name normalization.

import type { Listing } from './types.ts';

/** "₹1,234.50" | "32.28" | 32.28 → 123450 paise. Returns undefined for empty/invalid/≤0. */
export function toPaise(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/₹|rs\.?|inr|,|\s/gi, ''));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100);
}

/**
 * Pharmacies return generic "no photo" artwork instead of omitting the image
 * (Apollo's grey "Apollo 24|7" logo, PlatinumRx's default pack, 1mg's
 * "No preview available", Healthmug's id-0 image). Treat those as no image.
 */
const PLACEHOLDER_IMAGE = [
  /\/catalog\/product\/pharma\/[\w-]+\.(?:jpe?g|png|webp)$/i, // Apollo: /pharma/tablet.jpg, capsule.jpg …
  /hx2gxivwmeoxxxsc1hix/i, // 1mg "No preview available"
  /healthmug\.com\/images\/product\/0_\d+\./i, // Healthmug product id 0
  /(?:^|[/_-])(?:default[_-]?image|placeholder|no[_-]?image|image[_-]?not[_-]?available)[^/]*$/i,
];
export function isPlaceholderImage(url: string | undefined): boolean {
  return !url || PLACEHOLDER_IMAGE.some((re) => re.test(url));
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, ' ').trim();
}

const FORM_WORDS: [RegExp, string][] = [
  [/\b(tab|tabs|tablet|tablets)\b/i, 'tablet'],
  [/\b(cap|caps|capsule|capsules)\b/i, 'capsule'],
  [/\b(syp|syrup)\b/i, 'syrup'],
  [/\b(susp|suspension)\b/i, 'suspension'],
  [/\b(inj|injection|infusion|vial|ampoule)\b/i, 'injection'],
  [/\b(drop|drops)\b/i, 'drops'],
  [/\b(cream)\b/i, 'cream'],
  [/\b(gel)\b/i, 'gel'],
  [/\b(ointment|oint)\b/i, 'ointment'],
  [/\b(spray)\b/i, 'spray'],
  [/\b(sachet|powder|granules)\b/i, 'powder'],
  [/\b(lotion)\b/i, 'lotion'],
  [/\b(inhaler|rotacap|respule)s?\b/i, 'inhaler'],
  [/\b(solution|liquid)\b/i, 'solution'],
];

export function parseForm(...texts: (string | undefined)[]): string | undefined {
  const t = texts.filter(Boolean).join(' ');
  for (const [re, form] of FORM_WORDS) if (re.test(t)) return form;
  return undefined;
}

/** Release modifiers matter: SR/ER/CR/MR/XR/OD tablets are different products from plain ones. */
export function parseRelease(name: string): string | undefined {
  const m = name.match(/\b(sr|er|xr|cr|mr|od|xl|pr|ds)\b/i);
  return m?.[1]?.toLowerCase();
}

/** Strength tokens like "650mg", "0.5 g", "100mg/ml", "2.5%" from a name or composition. Normalized and sorted. */
export function parseStrengths(text: string): string[] {
  const out = new Set<string>();
  const re = /(\d+(?:\.\d+)?)\s*(mcg|µg|mg|gm|g|iu|ml|%)(?:\s*\/\s*(\d+(?:\.\d+)?)?\s*(ml|g|gm))?/gi;
  for (const m of text.matchAll(re)) {
    let value = Number(m[1]);
    let unit = (m[2] ?? '').toLowerCase();
    if (unit === 'µg') unit = 'mcg';
    if (unit === 'gm') unit = 'g';
    if (unit === 'g' && !m[4] && value < 10) { value *= 1000; unit = 'mg'; } // 0.5g → 500mg
    if (unit === 'ml' && !m[4]) continue; // "60 ml" is pack volume, not strength
    const per = m[4] ? `/${m[3] ?? ''}${m[4].toLowerCase().replace('gm', 'g')}` : '';
    out.add(`${+value.toFixed(3)}${unit}${per}`);
  }
  return [...out].sort();
}

/**
 * Pack size from labels like "strip of 15 tablets", "15 tab", "1X15", "15's", "60 ml", "1 BOTTLE(s) OF 100ML".
 * Returns count for solid forms or volume/weight for liquids/creams.
 */
export function parsePack(...texts: (string | undefined)[]): { units: number; unitType: NonNullable<Listing['unitType']> } | undefined {
  const parts = texts.filter((x): x is string => Boolean(x)).map((x) => x.toLowerCase());
  const t = parts.join(' ');
  let m = t.match(/(\d+(?:\.\d+)?)\s*(ml|g|gm)\b(?!\s*\/)/);
  const vol = m ? { units: Number(m[1]), unitType: (m[2] === 'ml' ? 'ml' : 'g') as 'ml' | 'g' } : undefined;
  // Count: plural ("15 tablets"), parenthesised ("(15tab)"), or a label that starts with the count ("15 tab").
  // A singular word after a number inside a name is a strength ("Dolo 650 Tablet"), not a count.
  m = t.match(/(\d+)\s*(tablets|tabs|capsules|caps)\b/) ?? t.match(/\(\s*(\d+)\s*(tab|cap)s?\s*\)/);
  if (!m) for (const p of parts) { m = p.match(/^\s*(\d+)\s*(tablet|tab|capsule|cap)s?\b/); if (m) break; }
  if (m) return { units: Number(m[1]), unitType: /cap/.test(m[2] ?? '') ? 'cap' : 'tab' };
  m = t.match(/\b1\s*x\s*(\d+)\b/) ?? t.match(/\b(\d+)\s*'s\b/) ?? t.match(/\b(\d+)s\b/);
  if (m && Number(m[1]) > 0 && Number(m[1]) <= 1000) {
    const unitType = /cap/.test(t) ? 'cap' : /tab/.test(t) ? 'tab' : 'unit';
    // "15's" next to a volume ("100ml") is ambiguous; prefer volume for liquids.
    if (vol && /syrup|suspension|solution|drops?|injection|infusion|cream|gel|ointment|lotion/.test(t)) return vol;
    return { units: Number(m[1]), unitType };
  }
  if (vol) return vol;
  return undefined;
}

/** Price per tablet/capsule/ml in paise (fractional ok, display-only rounding). */
export function perUnitPaise(l: Pick<Listing, 'pricePaise' | 'units'>): number | undefined {
  if (!l.units || l.units <= 0) return undefined;
  return l.pricePaise / l.units;
}

export function formatRupees(paise: number | undefined, opts: { decimals?: 0 | 2 } = {}): string {
  if (paise === undefined) return '–';
  const rupees = paise / 100;
  const decimals = opts.decimals ?? (Number.isInteger(rupees) ? 0 : 2);
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function discountPct(l: Pick<Listing, 'mrpPaise' | 'pricePaise'>): number {
  if (!l.mrpPaise || l.mrpPaise <= l.pricePaise) return 0;
  return Math.round(((l.mrpPaise - l.pricePaise) / l.mrpPaise) * 100);
}

const STOP = new Set(['tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps', 'strip', 'of', 'the', 'and', 'for', 'syrup', 'syp', 'injection', 'inj', 'with', 'pack', 'mg', 'ml', 's']);

/** Brand token: first meaningful word of the name ("Dolo-650 Tablet 15's" → "dolo"). */
export function brandToken(name: string): string {
  const words = stripHtml(name).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  return words.find((w) => !STOP.has(w) && !/^\d/.test(w)) ?? words[0] ?? '';
}

/** Lowercase alphanumeric tokens without pack/form noise, for similarity. */
export function nameTokens(name: string): string[] {
  return stripHtml(name)
    .toLowerCase()
    .replace(/(\d)\s*(mg|mcg|ml|g)\b/g, '$1$2')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w) && !/^\d+s?$/.test(w));
}
