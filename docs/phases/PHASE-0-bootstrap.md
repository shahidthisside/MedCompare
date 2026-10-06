# Phase 0: Bootstrap & Source Recon

## Goal
A working monorepo skeleton and verified, documented knowledge of how to get data from every source, before writing any real adapter.

## Tasks
### 0.1 Toolchain (verify current versions first; pin exact)
- [ ] Check current stable versions: Node LTS, pnpm, Next.js (Active LTS), React, Tailwind, Drizzle, BullMQ, Crawlee, Meilisearch, PostgreSQL, Valkey. Record them in `docs/DECISIONS.md`.
- [ ] `git init`, `.gitignore`, `.editorconfig`, `.nvmrc`, `LICENSE` (choose: MIT or AGPL, decide in DECISIONS.md).
- [ ] pnpm workspace + Turborepo; packages from CLAUDE.md layout (empty but building).
- [ ] TypeScript strict base config, Biome, Vitest workspace config.
- [ ] `docker-compose.yml`: postgres (with pg_trgm), valkey, meilisearch, all with healthchecks and named volumes.
- [ ] `.env.example` with every variable documented (`DATABASE_URL`, `VALKEY_URL`, `MEILI_URL`, `MEILI_MASTER_KEY`, `CRAWL_USER_AGENT`, …).
- [ ] `apps/web`: Next.js hello page reading `select 1` from Postgres.
- [ ] `apps/worker`: BullMQ worker processing a `ping` job.
- [ ] GitHub Actions CI: install → lint → typecheck → test → build.

### 0.2 Source SDK skeleton (`packages/sources/_sdk`)
- [ ] `politeFetch(url, {source})`: undici, timeout, UA from env, gzip, per-domain limiter (in-memory now, Valkey in Phase 2).
- [ ] `robots.ts`: fetch + parse + cache (use `robots-parser`), `isAllowed(url)`.
- [ ] `extract.ts`: `extractNextData(html)`, `extractWindowState(html, varName)` (bounded brace matcher), `extractJsonLd(html)`.
- [ ] `pnpm source:probe <source> <url>`: CLI that fetches, saves gzipped HTML to `fixtures/`, prints extracted JSON paths containing price/mrp/salt/pack.

### 0.3 Recon per source (P1 first: tata1mg, pharmeasy, netmeds, apollo, truemeds; then P2)
For each source create `packages/sources/<id>/RECON.md` with:
- [ ] robots.txt summary + sitemap URLs + approx. product URL count.
- [ ] 10 sample product URLs from sitemaps covering: plain tablet, combination drug, syrup, injection, OTC item, discontinued/out-of-stock, multiple pack sizes.
- [ ] Saved fixtures for all 10.
- [ ] JSON paths for: product ID, name, manufacturer, composition/salt, strength, form, pack size, MRP, selling price, stock, Rx flag, image.
- [ ] **Live API:** run `tools/endpoint-discovery` (or DevTools → Network → Fetch/XHR + `test-curl.mjs`). Document the search/suggest and product-detail endpoints in `ENDPOINTS.md` (method, params, minimal headers, sample response, token type, location fields). Mark `usable: yes/no` per the rules in `DATA_SOURCES.md`.
- [ ] Note blockers (Akamai, Cloudflare, JS-only rendering).
- [ ] Re-check deferred sources (MedPlus, Wellness Forever, Frank Ross, Flipkart Health+).

### 0.4 Reference data recon
- [ ] Locate current downloadable Jan Aushadhi product list (Excel/PDF/HTML table) and Kendra list; note format.
- [ ] Locate latest NPPA ceiling price compendium and notification index; note format (PDF tables → needs `pdfplumber`-like parsing, or the Pharma Sahi Daam site data).
- [ ] Download `junioralive/Indian-Medicine-Dataset` (MIT) to `data/raw/` (gitignored); record row count and checksum.
- [ ] NLEM 2022 and CDSCO banned FDC list sources.

### 0.5 Matching ground truth
- [ ] Hand-label 200 listings across sources into product groups (`packages/core/matching/__fixtures__/labelled.json`), including hard cases (SR vs IR, 500 vs 650 mg, combination order, syrup per 5 ml). This is the Phase 3 test set.

## Deliverables
Running skeleton, CI green, `RECON.md` + `ENDPOINTS.md` + fixtures per P1 source, reference-data notes, labelled matching set.

## Exit criteria
- `docker compose up -d && pnpm dev` shows the web page with DB OK and worker ping OK.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass in CI.
- `pnpm source:probe` works for all 5 P1 sources and extracts price + MRP from saved fixtures.
- Decision recorded for each P1 source: product-page extraction path confirmed; live API usable or not.

## Result
_(fill in when done: date, versions pinned, blockers found)_
