# CLAUDE.md — MedCompare

Guidance for AI coding agents (Claude Code, Kiro, etc.) working in this repository.
Read this file fully before writing code. Then read `docs/PLAN.md` and the current phase file in `docs/phases/`.

## What MedCompare is

An Indian medicine price-comparison platform. A user types a medicine (brand or salt), and MedCompare shows:

1. Live prices for the same product across Indian online pharmacies (Tata 1mg, PharmEasy, Netmeds, Apollo 24|7, Truemeds, PlatinumRx, Dawaa Dost, Medkart, Generic Aadhaar, Davaindia, Zeelab, MrMed, SastaSundar, …).
2. Cheaper substitutes with the same composition, strength and dosage form (branded generics).
3. The Jan Aushadhi (PMBJP) government generic equivalent and its MRP.
4. The NPPA ceiling price where the drug is price-controlled (DPCO 2013), with a flag if a listing exceeds it.
5. A prescription cart: add several medicines and see the cheapest total per pharmacy and the cheapest split.

This is a rewrite from scratch. The original repo (`shahidthisside/MedCompare`, Flask + 3 hard-coded medicines) was used only to understand the idea. **No code, data or design from it is reused.**

## Non-negotiable rules

1. **No hard-coded medicine or price data in application code.** Every price shown comes from a source adapter run, with a `fetchedAt` timestamp shown in the UI. Test fixtures are the only place static data may live.
2. **Freshness is visible.** Every price row shows how old it is. Prices older than the freshness SLA (see `docs/ARCHITECTURE.md`) are refreshed on view and marked "refreshing…" until done.
3. **Two fetch methods, both always on** (details in `docs/DATA_SOURCES.md`):
   - **Live API (primary):** call the public JSON endpoints each pharmacy's own website uses for search and price (found with Chrome DevTools → Network → Fetch/XHR, or `tools/endpoint-discovery`). Gives real-time, city-specific prices. Document each endpoint in `packages/sources/<source>/ENDPOINTS.md`.
   - **Product pages (fallback / enrichment):** sitemaps + product pages, parsing the embedded JSON (`__NEXT_DATA__`, `__INITIAL_STATE__`, JSON-LD). Used for sources without a usable API and to fill fields the API lacks (salt, manufacturer).
   - Both: per-domain rate limits, jittered delays, response caching per (query, city), exponential backoff on 429/5xx.
4. **Hard limits:** no CAPTCHA solving, no logging in or reusing a user's session/cookies, no reverse-engineering or forging signed tokens, no evading bot protection (Akamai/Cloudflare/Vercel challenges, TLS fingerprint spoofing, residential proxy rotation). Anonymous public tokens the site issues to every visitor (e.g. Apollo's `PUBLIC_ACCESS_TOKEN`) are fine: fetch them from the site's own token endpoint. If a source blocks us, mark it `blocked` and move on.
5. **Not medical advice.** Substitutes are shown as "same composition — ask your doctor or pharmacist before switching". Never recommend a drug for a condition. No dosage advice.
6. **Link out, don't sell.** We do not take orders or payments. Every price links to the pharmacy's product page. Affiliate links are allowed only via official affiliate programs and must be disclosed.
7. **Source adapters are isolated.** All pharmacy-specific parsing lives in `packages/sources/<source>/`. Nothing outside that folder knows a pharmacy's HTML/JSON shape.
8. **Every adapter has fixture tests** built from real captured pages (stored gzipped under `packages/sources/<source>/fixtures/`). A parser change without a passing fixture test is not done.
9. **Money is integers.** Store prices as paise (`integer`), never floats.
10. **Ask before committing, pushing or merging.** Never commit/push/merge without explicit per-batch permission.

## Current state (read first)

The working app is `apps/web` (see `README.md`): Next.js 16, React 19, Tailwind 4, TypeScript, Vitest; npm, no database. Live search across 7 pharmacy APIs through `/api/search/[source]`, location via `/api/location`, grouping, substitutes and cart in the browser. Commands: `npm run dev | test | typecheck | build | probe` inside `apps/web`.

The tech stack, layout and phases below are the **long-term roadmap** (catalog, history, alerts, more sources). Don't restructure `apps/web` into it until a phase needs it.

## Tech stack: long-term roadmap (pin exact versions when adopted)

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | One language (TypeScript) end to end, shared types |
| Web | Next.js 16 (App Router, RSC, Active LTS line), React 19, TypeScript strict | SSR/SEO for medicine pages, streaming |
| UI | Tailwind CSS v4, shadcn/ui (Radix), lucide icons, Recharts | Accessible primitives, custom design system |
| Client data | TanStack Query + Server-Sent Events for live price updates | Prices stream in as adapters return |
| Validation | Zod (shared schemas web ↔ worker) | |
| DB | PostgreSQL 17+ with `pg_trgm`, `unaccent` | Relational catalog, price history |
| ORM | Drizzle ORM + drizzle-kit migrations | Typed SQL, lightweight |
| Search | Meilisearch (self-hosted) | Typo-tolerant instant search, synonyms (Crocin ↔ Paracetamol) |
| Queue / cache | Valkey (Redis-compatible) + BullMQ | Crawl jobs, live-refresh jobs, rate limiting, cache |
| Crawling | Crawlee (HttpCrawler/CheerioCrawler; PlaywrightCrawler only as a fallback) + undici | Sitemaps, retries, per-domain throttling |
| Auth (Phase 7) | Better Auth (email magic link + Google) | Saved carts, price alerts |
| Notifications | Web Push (VAPID) + email via Resend/SMTP | Price-drop alerts |
| Tests | Vitest (unit/fixture), Playwright (e2e), MSW | |
| Lint/format | Biome | Single fast tool |
| Observability | pino logs, OpenTelemetry, Sentry (optional), Bull Board | Adapter health is a first-class concern |
| Local infra | Docker Compose (postgres, valkey, meilisearch) | |
| Deploy | Web on Vercel (or Docker); worker + Postgres + Valkey + Meilisearch on a VPS/Railway/Fly | Worker needs long-running processes |

Do not swap a stack choice without writing the reason in `docs/DECISIONS.md`.

## Repository layout

```text
MedCompare/
├── apps/
│   ├── web/                 # Next.js app (UI + route handlers for public API)
│   └── worker/              # BullMQ workers: discovery, fetch, refresh, alerts, reindex
├── packages/
│   ├── db/                  # Drizzle schema, migrations, query helpers
│   ├── core/                # Domain: normalization, matching, pricing math, Zod schemas
│   ├── sources/             # One folder per pharmacy/government source (adapters)
│   │   ├── _sdk/            # Adapter interface, polite fetcher, robots cache, extract helpers
│   │   ├── tata1mg/
│   │   ├── pharmeasy/
│   │   └── …
│   ├── search/              # Meilisearch index config + sync
│   └── ui/                  # Shared design-system components
├── scripts/                 # Seed/import scripts (datasets, Jan Aushadhi, NPPA)
├── docs/
│   ├── PLAN.md
│   ├── ARCHITECTURE.md
│   ├── DATA_SOURCES.md
│   ├── DESIGN.md
│   ├── DECISIONS.md
│   └── phases/PHASE-0 … PHASE-9
├── docker-compose.yml
└── CLAUDE.md
```

## Commands (create these in Phase 0; keep this list accurate)

```bash
pnpm install
pnpm dev                 # web + worker + docker services
pnpm db:migrate
pnpm db:seed             # imports open datasets (scripts/)
pnpm test                # vitest across packages
pnpm test:e2e            # playwright
pnpm lint                # biome check
pnpm typecheck
pnpm build
pnpm source:probe <id>   # fetch 1 live page for an adapter and print parsed result
pnpm source:health       # run every adapter against 3 known products, report pass/fail
```

## Definition of done (every task)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- New adapter/parser code has fixture tests; matching changes have unit tests with real examples.
- UI changes checked at 360px, 768px and 1280px widths, keyboard-navigable, no axe violations.
- No new hard-coded prices/medicines outside fixtures.
- Docs updated if behaviour, commands or schema changed.
- Never claim something works without having run it. Report failures honestly.

## Working style

- Work phase by phase (`docs/phases/`). Do not start a phase before the previous phase's exit criteria pass.
- Small, reviewable changes. Read existing code before editing.
- When a source's markup changes, fix the adapter and add a new fixture; do not loosen tests.
- Write decisions with trade-offs into `docs/DECISIONS.md` (ADR style, one paragraph each).
