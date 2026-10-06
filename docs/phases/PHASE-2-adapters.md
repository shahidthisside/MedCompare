# Phase 2: Source Adapters & Crawler

## Goal
Real prices from the 5 P1 pharmacies (Tata 1mg, PharmEasy, Netmeds, Apollo, Truemeds) flowing into Postgres via live APIs where available, plus sitemaps and product pages.

## Tasks
### 2.1 SDK hardening (`packages/sources/_sdk`)
- [ ] Valkey-backed per-domain token bucket (shared across worker processes).
- [ ] Retry with backoff + jitter, circuit breaker per source, `Retry-After` honoured.
- [ ] Robots.txt check for the sitemap/product-page crawler (log `robots_blocked`).
- [ ] Sitemap reader: index → child sitemaps, gzip support, `lastmod`, streaming (sitemaps can be 50k URLs each).
- [ ] `SourceAdapter` interface + `RawListing` Zod schema (see `DATA_SOURCES.md` §5).

### 2.2 Adapters (one folder each, same structure)
```text
packages/sources/tata1mg/
  index.ts        # adapter: discover(), fetchListing(), search?()
  parse.ts        # pure: html/json → RawListing (no I/O)
  schema.ts       # Zod for embedded state / API response
  RECON.md  ENDPOINTS.md
  fixtures/*.html.gz
  parse.test.ts   # every fixture → expected RawListing snapshot
```
- [ ] tata1mg
- [ ] pharmeasy
- [ ] netmeds
- [ ] apollo
- [ ] truemeds
- Parsing order: embedded state JSON, then JSON-LD, then selectors. Fail loudly with a typed `ParseError` naming the missing field.

### 2.3 Worker jobs (`apps/worker`)
- [ ] `discover:<source>`: weekly; streams sitemap URLs and upserts `listing(url, status=pending)`.
- [ ] `fetch-listing`: fetch + parse, upsert listing fields, append `price_point` only if price/MRP/stock changed (`rawHash`); mark `gone` on 404/410.
- [ ] Scheduler fills the fetch queue respecting each source's daily budget (config: e.g. 20k pages/day/source).
- [ ] Bull Board at `/admin/queues` (basic-auth protected).

### 2.4 Live search APIs (every source Phase 0 marked usable)
- [ ] `search(query, location)` per adapter; location mapped to the source's format (city header, PIN in body, lat/lng); response Zod-validated; fixture tests from saved responses.
- [ ] Token providers for sources with anonymous public tokens (e.g. Apollo `auth-service/accessToken`), cached until shortly before expiry.

## Exit criteria
- Fixture tests pass for all 5 adapters (≥10 fixtures each).
- A 1-hour crawl run ingests ≥2,000 listings per P1 source with <2% parse errors, zero robots violations in logs, and no 429 storms.
- `pnpm source:health` passes for all 5.

## Result
_(fill in)_
