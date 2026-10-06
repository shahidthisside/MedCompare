# Phase 4: Search & Public API

## Goal
Instant, typo-tolerant search and a typed API that the web app (and future mobile app) consumes.

## Tasks
### 4.1 Meilisearch (`packages/search`)
- [ ] Index `products`: brandName, salts, compositionKey, manufacturer, form, strength, lowestPricePerUnit, sourceCount, popularity, isJanAushadhi.
- [ ] Searchable attribute order: brandName > salts > manufacturer. Ranking rules include popularity and sourceCount.
- [ ] Synonyms from the salt synonym dictionary (+ common misspellings: "paracitamol", "azithromicin").
- [ ] Filterable: form, rxRequired, isJanAushadhi; sortable: lowestPricePerUnit.
- [ ] Incremental sync worker job on product/listing change (debounced) + nightly full reindex.

### 4.2 API (Next.js route handlers in `apps/web/app/api`)
- [ ] Endpoints listed in `ARCHITECTURE.md`, request/response Zod schemas in `packages/core/api`.
- [ ] Rate limiting (Valkey sliding window) and `Cache-Control` headers (s-maxage + stale-while-revalidate).
- [ ] Consistent error shape `{error:{code,message}}`.
- [ ] OpenAPI spec generated from Zod (`zod-openapi`) at `/api/openapi.json`.
- [ ] Integration tests against a test Postgres + Meilisearch (Testcontainers or compose profile).

## Exit criteria
- p95 search latency < 50 ms server-side with the full catalog.
- "dolo", "dolo 650", "paracetamol 650", "paracitamol", "crocin" each return the expected product in the top 3.
- All API integration tests pass.

## Result
_(fill in)_
