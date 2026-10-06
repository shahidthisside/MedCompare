// Browser-safe source metadata (no server fetch code). Keep in sync with adapters.ts.
import type { SourceId } from '../types.ts';

export interface SourceMeta {
  id: SourceId;
  name: string;
  short: string;
  code: string; // 3-letter ticker code
  mono: string; // monogram shown in the brand-colour mark
  site: string;
  color: string;
  locationAware: 'city' | 'pin' | 'none';
}

/** Link to the pharmacy's own search page, used when its API can't be reached from our server. */
export function siteSearchUrl(id: SourceId, q: string): string {
  const e = encodeURIComponent(q.trim());
  switch (id) {
    case 'tata1mg': return `https://www.1mg.com/search/all?name=${e}`;
    case 'pharmeasy': return `https://pharmeasy.in/search/all?name=${e}`;
    case 'apollo': return `https://www.apollopharmacy.in/search-medicines/${e}`;
    case 'medplus': return `https://www.medplusmart.com/searchAll/${e}`;
    default: return SOURCE_BY_ID[id].site;
  }
}

export const SOURCES: SourceMeta[] = [
  { id: 'tata1mg', mono: '1mg', code: '1MG', name: 'Tata 1mg', short: '1mg', site: 'https://www.1mg.com', color: '#ff6f61', locationAware: 'city' },
  { id: 'pharmeasy', mono: 'PE', code: 'PHE', name: 'PharmEasy', short: 'PharmEasy', site: 'https://pharmeasy.in', color: '#10847e', locationAware: 'none' },
  { id: 'netmeds', mono: 'N', code: 'NMS', name: 'Netmeds', short: 'Netmeds', site: 'https://www.netmeds.com', color: '#32aeb1', locationAware: 'none' },
  { id: 'apollo', mono: 'A', code: 'APL', name: 'Apollo Pharmacy', short: 'Apollo', site: 'https://www.apollopharmacy.in', color: '#0f847e', locationAware: 'pin' },
  { id: 'truemeds', mono: 'T', code: 'TRM', name: 'Truemeds', short: 'Truemeds', site: 'https://www.truemeds.in', color: '#2a6ad9', locationAware: 'none' },
  { id: 'platinumrx', mono: 'P', code: 'PRX', name: 'PlatinumRx', short: 'PlatinumRx', site: 'https://www.platinumrx.in', color: '#5b5bd6', locationAware: 'none' },
  { id: 'medkart', mono: 'MK', code: 'MKT', name: 'Medkart', short: 'Medkart', site: 'https://www.medkart.in', color: '#e8590c', locationAware: 'none' },
  { id: 'mrmed', mono: 'MR', code: 'MRM', name: 'MrMed', short: 'MrMed', site: 'https://www.mrmed.in', color: '#1971c2', locationAware: 'none' },
  { id: 'healthmug', mono: 'H', code: 'HMG', name: 'Healthmug', short: 'Healthmug', site: 'https://www.healthmug.com', color: '#c2255c', locationAware: 'none' },
  { id: 'medplus', mono: 'M+', code: 'MPL', name: 'MedPlus Mart', short: 'MedPlus', site: 'https://www.medplusmart.com', color: '#2f9e44', locationAware: 'none' },
];

export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s])) as Record<SourceId, SourceMeta>;
