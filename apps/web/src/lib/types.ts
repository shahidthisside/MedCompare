// Shared domain types. Money is always integer paise.

export type SourceId = 'tata1mg' | 'pharmeasy' | 'netmeds' | 'apollo' | 'truemeds' | 'platinumrx' | 'medkart' | 'mrmed' | 'healthmug' | 'medplus';

export interface UserLocation {
  pin: string; // 6-digit Indian PIN code
  city: string; // display + 1mg city name
  district?: string;
  state?: string;
}

/** One product row from one pharmacy, normalized. */
export interface Listing {
  source: SourceId;
  id: string; // source product id
  name: string;
  url: string; // pharmacy product page
  imageUrl?: string;
  manufacturer?: string;
  composition?: string; // "Paracetamol 650mg"
  form?: string; // tablet, syrup …
  packLabel?: string; // "15 tablets"
  units?: number; // count in pack (tablets/capsules) or volume (ml/g)
  unitType?: 'tab' | 'cap' | 'ml' | 'g' | 'unit';
  mrpPaise?: number;
  pricePaise: number;
  inStock: boolean;
  rxRequired?: boolean;
  eta?: string;
}

export interface SourceResult {
  source: SourceId;
  ok: boolean;
  listings: Listing[];
  error?: string;
  tookMs: number;
  fetchedAt: string; // ISO
  cached?: boolean;
}

/** Same medicine grouped across pharmacies. */
export interface ProductGroup {
  key: string;
  title: string;
  composition?: string;
  manufacturer?: string;
  form?: string;
  strength?: string;
  units?: number;
  unitType?: Listing['unitType'];
  imageUrl?: string;
  rxRequired?: boolean;
  offers: Listing[]; // sorted by price, cheapest first
  best?: Listing;
  relevance: number;
}
