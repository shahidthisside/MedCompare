# Architecture

## System overview

```text
                ┌──────────────────────────── apps/web (Next.js) ───────────────────────────┐
 Browser ──────▶│ RSC pages (SEO)   /api/* route handlers   /api/live/:id (SSE stream)      │
                └──────┬───────────────────┬──────────────────────────┬────────────────────┘
                       │ SQL (Drizzle)     │ search                    │ enqueue refresh / subscribe
                       ▼                   ▼                           ▼
                 ┌──────────┐       ┌─────────────┐            ┌──────────────┐
                 │ Postgres │◀──────│ Meilisearch │◀── sync ───│    Valkey    │ (BullMQ queues, cache, pub/sub)
                 └────▲─────┘       └─────────────┘            └──────▲───────┘
                      │ upsert listings / prices                      │ jobs
                ┌─────┴──────────────── apps/worker ─────────────────┴──────────┐
                │ discovery · fetch · refresh-scheduler · live-refresh · match   │
                │ reindex · reference-import · alerts · adapter-health           │
                └─────┬──────────────────────────────────────────────────────────┘
                      │ polite HTTP (per-domain limiter, robots cache)
                      ▼
        Pharmacy live JSON APIs (primary) · sitemaps / product pages (fallback) · gov data
```

The web app never calls pharmacies directly. It reads Postgres, and when data is stale it **enqueues** a live-refresh job and **subscribes** (Valkey pub/sub → SSE) so fresh prices stream into the open page within seconds.

## Domain model

```text
Salt            (id, name, synonyms[])                    e.g. Paracetamol / Acetaminophen
Composition     (id, key)                                 canonical key: "paracetamol:650mg" or
                                                          "amoxicillin:500mg+clavulanic_acid:125mg"
Product         (id, brandName, manufacturer, compositionId, form, strength, rxRequired,
                 isJanAushadhi, isBannedFdc, nlem, slug)   one real-world medicine SKU family
PackVariant     (id, productId, unitsPerPack, unitType)   strip of 10 / 15 tablets, 60ml bottle
Listing         (id, source, sourceProductId, url, packVariantId?, productId?, matchConfidence,
                 matchStatus[auto|review|rejected], lastFetchedAt, status[active|gone|blocked])
PricePoint      (listingId, city, fetchedAt, mrpPaise, pricePaise, inStock)   append-only time series; city matters (prices vary by city)
CeilingPrice    (compositionId, form, unit, ceilingPaise, notification, effectiveFrom)
JanAushadhiItem (drugCode, genericName, compositionId, unitSize, mrpPaise)
Kendra          (code, name, address, district, state, pin, lat?, lng?)
User / Cart / CartItem / PriceAlert              (Phase 7)
SourceHealth    (source, checkedAt, ok, latencyMs, error)
```

Postgres specifics: `pg_trgm` GIN indexes on names; `PricePoint` partitioned by month (or TimescaleDB later if volume demands). Latest price is kept denormalized on `Listing` (`currentPricePaise`, `currentMrpPaise`) for fast reads.

## Matching engine (`packages/core/matching`)

Goal: map every `Listing` to the right `Product` + `PackVariant` so prices are comparable.

1. **Normalize composition text:** lowercase, unaccent, salt synonym map (paracetamol = acetaminophen, amoxycillin = amoxicillin), strength units (`mcg`→`µg`, `0.5g`→`500mg`, `% w/v`, `mg/5ml`), and sort salts alphabetically to get the canonical key.
2. **Normalize form:** tablet / tablet SR / tablet ER / capsule / syrup / suspension / injection / drops / cream… SR and ER are different products from IR.
3. **Parse pack:** "strip of 15 tablets" gives 15 tablets; "bottle of 60 ml" gives 60 ml.
4. **Score:** exact composition key + form, then brand name trigram similarity + manufacturer match. Score ≥ 0.92 auto-matches; 0.75–0.92 goes to the review queue (simple admin page); below that a new Product is created.
5. **Substitutes** = same composition key + same form (+ same release type). Never cross form or strength.
6. Every rule has unit tests from real listings collected in Phase 0.

## Pricing math (`packages/core/pricing`)
- `pricePerUnit = pricePaise / unitsPerPack` (rounded at display time only).
- Savings vs. the user's chosen brand = `(brandPPU − altPPU) × quantityUnits`.
- Cart optimizer: for N items × M pharmacies, compute (a) cheapest single-pharmacy total (users prefer one order) and (b) cheapest split. Ignore delivery fees until we can source them reliably, and say so in the UI.
- Ceiling check: flag if `pricePerUnit > ceilingPerUnit` for a scheduled formulation (show as "above NPPA ceiling — verify", never as an accusation).

## Freshness SLA
| Tier | Which listings | Background refresh | On-view refresh if older than |
|---|---|---|---|
| Hot | viewed/carted in last 24h or top 2,000 searches | 4h | 30 min |
| Warm | viewed in last 30 days | 24h | 6h |
| Cold | everything else | 7d | 24h |

The UI shows "Updated 12 min ago" per row and a live spinner while refreshing.

## Live refresh flow
1. User opens `/medicine/dolo-650-tablet`. RSC renders cached prices immediately.
2. Server checks staleness per listing and enqueues `live-refresh` jobs (deduplicated by listingId with BullMQ job IDs).
3. Client opens `EventSource('/api/live/<productId>')`. The route subscribes to the Valkey channel `product:<id>`.
4. Worker fetches → parses → writes PricePoint → publishes. The client patches the row in place.
5. Every search fans out to the live search adapters in parallel (3s timeout each, cached per query + city) and streams results; matched results are persisted.

## Politeness and resilience (`packages/sources/_sdk`)
- Robots.txt fetched and cached 24h per domain for the product-page crawler (sitemap discovery).
- Per-domain token bucket (default 1 req/s, burst 2) shared across workers via Valkey.
- Retries: exponential backoff with jitter on 429/5xx/timeouts, max 3. A circuit breaker opens after 10 consecutive failures and auto-probes every 15 min.
- Conditional GET (`If-Modified-Since`/ETag) where supported; `rawHash` to skip no-op writes.
- Adapter health job runs every hour against 3 canary products per source. Failures show on `/status` and alert the maintainer.

## Public API (route handlers, Zod-validated, rate-limited per IP)
```text
GET  /api/search?q=&limit=            → products (Meilisearch)
GET  /api/products/:slug              → product, pack variants, listings with latest prices
GET  /api/products/:slug/substitutes  → same composition, sorted by price per unit
GET  /api/products/:slug/history      → price history per source
GET  /api/live/:productId             → SSE stream of price updates
POST /api/cart/compare                → {items:[{productId,packVariantId,qty}]} → per-pharmacy totals + split
GET  /api/jan-aushadhi/kendras?pin=   → nearby kendras
GET  /api/status                      → per-source health
```

## Security and privacy
- No accounts needed to compare. Accounts (Phase 7) only for alerts and saved carts. Store minimal PII (email); follow India's DPDP Act 2023 basics: consent, deletion on request, privacy page.
- Prescription upload/OCR (optional later phase) processes images in memory and never stores them by default.
- Rate limiting (Valkey sliding window) on all API routes; strict CSP; no third-party trackers; plausible/umami for privacy-friendly analytics if any.
- Secrets only in env vars; `.env.example` committed, `.env` never.
