# Phase 1: Data Foundation

## Goal
The full database schema and real reference data loaded. After this phase, nothing in the app needs hard-coded medicine data.

## Tasks
### 1.1 Schema (`packages/db`)
- [ ] Drizzle schema for: `salt`, `salt_synonym`, `composition`, `composition_salt` (salt, strength value, unit), `product`, `pack_variant`, `source`, `listing`, `price_point` (monthly partitions), `ceiling_price`, `jan_aushadhi_item`, `kendra`, `banned_fdc`, `nlem_entry`, `source_health`, `crawl_run`.
- [ ] Money columns are `integer` paise; timestamps are `timestamptz`.
- [ ] Indexes: trigram GIN on `product.brand_name`, `salt.name`; unique (`source`, `source_product_id`); `listing(product_id)`, `listing(last_fetched_at)`; `price_point(listing_id, fetched_at desc)`.
- [ ] Extensions migration: `pg_trgm`, `unaccent`.
- [ ] Seed `source` table from a typed config (`packages/sources/registry.ts`). This is config, not price data.

### 1.2 Core normalization primitives (`packages/core`), test-driven
- [ ] `parseStrength("0.5 g") → {value:500, unit:"mg"}`; units mg, g, mcg/µg, iu, %, mg/ml, mg/5ml, % w/w, % w/v.
- [ ] `parseComposition("Amoxycillin (500mg) + Clavulanic Acid (125mg)")` → canonical key.
- [ ] Salt synonym dictionary (`packages/core/data/salt-synonyms.json`, reviewed list; this is reference vocabulary, not prices).
- [ ] `parseForm`, `parsePack("strip of 15 tablets")`.
- [ ] `parseRupeesToPaise("₹1,234.50")`.
- [ ] ≥150 unit tests from Phase 0 fixtures.

### 1.3 Reference importers (`scripts/import-*.ts`, idempotent, re-runnable by the worker on schedule)
- [ ] `import-seed-catalog`: junioralive dataset → `product`, `composition`, `pack_variant` (prices **not** imported; discontinued flag kept).
- [ ] `import-jan-aushadhi`: product list → `jan_aushadhi_item` linked to compositions.
- [ ] `import-kendras`: Kendra list → `kendra` (+ geocode by PIN centroid using India Post PIN directory from data.gov.in).
- [ ] `import-nppa-ceiling`: ceiling price notifications → `ceiling_price` (PDF table extraction; keep notification number + date).
- [ ] `import-nlem`, `import-banned-fdc`.
- [ ] Each importer logs counts (inserted/updated/unmatched) into `crawl_run` and writes unmatched rows to a review CSV.

## Exit criteria
- `pnpm db:migrate && pnpm db:seed` on an empty DB completes and loads ≥200k products, ≥1,500 Jan Aushadhi items, ceiling prices, kendras.
- ≥90% of Jan Aushadhi items link to a composition.
- All normalization tests pass.

## Result
_(fill in)_
