# Data Sources

Recon done on 2026-10-06 with `curl` (desktop Chrome UA). Re-verify everything in Phase 0. Markup and endpoints change, so treat this file as a starting point.

## 1. Pharmacies (price sources)

| ID | Site | robots.txt | Sitemap | Product page data (verified) | Priority |
|---|---|---|---|---|---|
| `tata1mg` | 1mg.com | `/search` disallowed, `/drugs/*` allowed | `sitemap_drugs_N.xml` | `window.__INITIAL_STATE__` has `price`, `mrp`. **Live search API verified**; see `packages/sources/tata1mg/ENDPOINTS.md` | P1 |
| `pharmeasy` | pharmeasy.in | `/api/`, `/search/all*` disallowed | `sitemap-prescription-medicines.xml`, `sitemap-otc-products.xml`, `sitemap-molecule.xml` | `__NEXT_DATA__` + JSON-LD (`price`, `salePrice`) | P1 |
| `netmeds` | netmeds.com | `/search`, `/api/` disallowed (`/api/service/` allowed) | `sitemap/root.sitemap.xml`, brand/category sitemaps | `window.__INITIAL_STATE__` + JSON-LD (`price`, `mrp`) | P1 |
| `apollo` | apollopharmacy.in | `/search/`, `/medicine/search-medicines/` disallowed | `sitemap-pharma-rx.xml`, `sitemap-pharma-otc.xml`, `sitemap-salt.xml`, `sitemap-substitute.xml` | 7× JSON-LD blocks (`price`) | P1 |
| `truemeds` | truemeds.in | `/search`, `/api/*` disallowed | `sitemap-core.xml`, `sitemap-brands-N.xml` | `__NEXT_DATA__` + JSON-LD (`price`, `mrp`). Guessed slugs resolve to the wrong product, so always use sitemap URLs | P1 |
| `platinumrx` | platinumrx.in | `/medicines/`, `/salt/` allowed | `medicines-sitemap.xml`, `salt-sitemap.xml`, `substitute-sitemap.xml` | Next.js app | P2 |
| `dawaadost` | dawaadost.com | reachable | 20 sitemap lines in robots | TBD Phase 0 | P2 |
| `medkart` | medkart.in | reachable | yes | TBD (generic-focused chain) | P2 |
| `genericaadhaar` | genericaadhaar.com | reachable | yes | TBD (generic chain) | P2 |
| `davaindia` | davaindia.com | reachable | yes | TBD (Zota generic chain) | P2 |
| `zeelab` | zeelabpharmacy.com | reachable | yes | TBD (generic brand) | P3 |
| `mrmed` | mrmed.in | reachable | yes | TBD (specialty/oncology) | P3 |
| `sastasundar` | sastasundar.com | reachable, no sitemap in robots | TBD | TBD | P3 |
| `healthmug` | healthmug.com | reachable | none listed | TBD | P3 |
| `medplus` | medplusmart.com | **403 (Akamai)** | n/a | Blocked. Do not bypass | Deferred |
| `wellnessforever` | wellnessforever.com | **429** | n/a | Retry in Phase 0, else defer | Deferred |
| `frankross` | frankrossgroup.in | no response | n/a | Re-check | Deferred |
| `flipkarthealth` | healthplus.flipkart.com | no response | n/a | Re-check | Deferred |
| `amazon` | amazon.in pharmacy | Amazon ToS forbids scraping | n/a | Only via the official Product Advertising API, if eligible | Deferred |

## 2. Fetch methods (both always on)

### Live API (primary)
The same public JSON endpoints a pharmacy's own website calls when you type in its search box. Gives real-time, city-specific prices, including for medicines not yet in our catalog.

**Automated:** `tools/endpoint-discovery/` does steps 1–5 automatically (`discover.mjs`) or tests a pasted DevTools cURL (`test-curl.mjs`). The latest results table is in its README. As of 2026-10-06, 7 sources have working live search APIs (1mg, Apollo, PlatinumRx, Medkart, MrMed, Healthmug, MedPlus), plus a Netmeds batch-price API.

How to discover an endpoint by hand (per source):
1. Open the site in Chrome, then DevTools → Network → filter **Fetch/XHR** → check "Preserve log".
2. Type a medicine into the site's search box. Find the request that returns product JSON (look for `search`, `suggest`, `autocomplete`, `products`, GraphQL `operationName`).
3. Right-click → Copy → **Copy as cURL**. Replay it with `test-curl.mjs`, which finds the minimal working headers and tests two locations.
4. Record it in `packages/sources/<id>/ENDPOINTS.md`: URL, method, required params/headers, sample response (trimmed), observed rate limit, date verified.
5. Also check the product-detail XHR. It often returns price + stock directly and is cheaper than parsing HTML.
6. Write a Zod schema for the response and a fixture test from the saved sample.

Rules:
- Endpoints must work without a logged-in session. Anonymous public tokens issued by the site's own token endpoint are fine (refresh before expiry).
- If an endpoint needs a signed or rotating token (HMAC header, device fingerprint, bot-protection cookie), do not reverse or forge it. Use product pages for that source.
- Rate limit per domain (start at 1 req/s from the server/relay), cache results 10–15 min per (query, city), and use sitemaps rather than search endpoints for bulk catalogue discovery.

### Product pages (fallback / enrichment)
1. **Discovery:** read each sitemap index, then the product sitemaps, and upsert `listing_url` rows with `lastmod`.
2. **Fetch:** GET the product page (HTML). Extract in this order of preference:
   1. Embedded app state (`__NEXT_DATA__`, `__INITIAL_STATE__`): richest data (salt, strength, pack, MRP, selling price, stock, manufacturer).
   2. JSON-LD `Product`/`Drug` + `Offer`.
   3. CSS selectors (last resort).
3. **Refresh tiers:** hot (viewed or in carts in the last 24h) every 2–6h, warm daily, cold weekly. On-view refresh if older than the SLA.

## 3. Reference / open data (catalog, generics, regulation)

| Source | What | Use | Refresh |
|---|---|---|---|
| PMBI Jan Aushadhi product list (janaushadhi.gov.in, ~2,000 items: 1,250+ medicines, 200+ surgicals) | Generic name, drug code, unit size, MRP, therapeutic group | Govt generic equivalent + price | Monthly scrape/import |
| Jan Aushadhi Kendra locator (janaushadhi.gov.in) | Store addresses by state/district/PIN | "Nearest Kendra" feature | Monthly |
| NPPA ceiling prices (nppa.gov.in notifications, Pharma Sahi Daam) | Ceiling price per unit for scheduled formulations (DPCO 2013 / NLEM 2022) | Overpricing flag, price context | Weekly check for new notifications |
| NPPA retail prices of new drugs | Retail price notified per formulation/company | Context | Weekly |
| NLEM 2022 (MoHFW) | Essential medicines list | "Essential medicine" badge | Yearly |
| CDSCO banned FDC list | Banned fixed-dose combinations | Warning badge, hide from substitutes | Monthly |
| `junioralive/Indian-Medicine-Dataset` (MIT, ~254k rows) | Name, manufacturer, pack, composition, old price | **Bootstrap only**: seed brand names and compositions for search and matching. Its prices are stale and never shown | One-time seed |
| Kaggle "A-Z Medicine Dataset of India" | Similar | Cross-check normalization | One-time |
| openFDA / DailyMed labels | Salt-level info (uses, side effects) | Optional salt info pages, attributed | Optional |

## 4. Official / partner channels (prefer when available)
- **Affiliate networks** (Cuelinks, EarnKaro, Admitad, INRDeals) run programs for Tata 1mg and PharmEasy. Apply. Some give deep-link APIs and product feeds, which are a legitimate, stable price source. Disclose affiliate links in the UI.
- **Tata 1mg partners** (partners.1mg.com) and direct outreach to generic chains (Medkart, Dawaa Dost, Generic Aadhaar), who often want the visibility.
- **ONDC** (Open Network for Digital Commerce) has a health/pharma retail category with open protocol specs. A buyer-app integration requires network registration. Long-term option, out of MVP scope.

## 5. Adapter contract (summary; full interface in `packages/sources/_sdk`)

```ts
interface SourceAdapter {
  id: SourceId;
  displayName: string;
  baseUrl: string;
  capabilities: { sitemap: boolean; productPage: boolean; liveSearch: boolean };
  discover(ctx): AsyncIterable<DiscoveredUrl>;            // sitemaps
  fetchListing(url, ctx): Promise<RawListing>;             // product page → normalized listing
  search?(query, location, ctx): Promise<RawListing[]>;    // live search API (city/PIN-aware)
}

interface RawListing {
  source: SourceId;
  sourceProductId: string;
  url: string;
  title: string;
  manufacturer?: string;
  compositionText?: string;   // "Paracetamol (650mg)"
  form?: string;              // tablet, syrup, injection…
  packSizeText?: string;      // "strip of 15 tablets"
  mrpPaise?: number;
  pricePaise: number;         // selling price
  inStock?: boolean;
  rxRequired?: boolean;
  imageUrl?: string;
  fetchedAt: Date;
  rawHash: string;            // detect no-op refreshes
}
```

## 6. Known pitfalls
- Same brand, different pack sizes (10 vs 15 tablets). Always compare **price per unit**, and also show pack price.
- Selling price depends on **city** (verified on 1mg: Dolo 650 ₹28.30 in Gurgaon vs ₹30.60 in Mumbai), and possibly PIN code, membership (1mg Plus, PharmEasy Plus) or coupons. Store prices **per city** (`price_point.city`), use the logged-out non-member price, never the coupon price, and label it so.
- Truemeds and PharmEasy may show a "substitute" product on the page. Parse the primary product only.
- MRP strings like "₹32.28" or "MRP ₹32.28/strip". Parse into paise robustly.
- 1mg pages ship large inline state (~440 KB). Parse with a bounded JSON extractor, not regex over the whole page.
