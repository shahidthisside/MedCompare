# MedCompare — Build Plan

Rebuild from scratch. Each phase has its own file in `docs/phases/` with tasks, deliverables and **exit criteria**. Do not start a phase until the previous one's exit criteria pass and are recorded in that phase file's "Result" section.

| Phase | Name | Outcome |
|---|---|---|
| 0 | [Bootstrap & source recon](phases/PHASE-0-bootstrap.md) | Monorepo runs; every source probed; fixtures captured; endpoints documented |
| 1 | [Data foundation](phases/PHASE-1-data-foundation.md) | Schema, migrations, reference imports (Jan Aushadhi, NPPA, NLEM, CDSCO, seed catalog) |
| 2 | [Source adapters & crawler](phases/PHASE-2-adapters.md) | 5 P1 pharmacies crawled end-to-end via sitemaps with fixture tests |
| 3 | [Normalization & matching](phases/PHASE-3-matching.md) | Listings matched to products with ≥95% precision on a labelled set |
| 4 | [Search & public API](phases/PHASE-4-search-api.md) | Meilisearch instant search + typed REST API |
| 5 | [Real-time freshness](phases/PHASE-5-realtime.md) | Refresh tiers, on-view refresh, SSE streaming, live search APIs |
| 6 | [Web app & design system](phases/PHASE-6-web.md) | All core screens, accessible, fast, responsive |
| 7 | [Value features](phases/PHASE-7-features.md) | Cart optimizer, substitutes, Jan Aushadhi locator, history, accounts, price alerts |
| 8 | [More sources & hardening](phases/PHASE-8-hardening.md) | P2/P3 sources, health monitoring, e2e tests, perf, security review |
| 9 | [Deploy & launch](phases/PHASE-9-deploy.md) | Production deploy, backups, monitoring, SEO, Hindi |

MVP = Phases 0–6 (search → live compare across 5 pharmacies → substitutes). Phases 7–9 make it excellent.

## Guiding decisions
- **Own catalog, live prices.** Search hits our index (fast, typo-tolerant). Prices are refreshed from sources continuously and on demand, so nothing is hard-coded and the site stays current.
- **Compare per unit, not per pack.**
- **Adapters break; design for it.** Isolation, fixtures, health checks, circuit breakers, `/status` page.
- **Two fetch methods, both on:** live JSON APIs (primary, city-specific) and product pages (fallback/enrichment). See `DATA_SOURCES.md`.

## Risks
| Risk | Mitigation |
|---|---|
| Pharmacy markup or endpoint changes | Fixture tests + hourly canary health checks + multi-strategy extraction (state JSON → JSON-LD → selectors) |
| IP blocking / rate limiting | Low rates, caching, refresh tiers, circuit breakers; never evade protection |
| Wrong match (comparing different strengths) | Strict composition+form keys; review queue for mid-confidence; precision target ≥95% |
| PIN/membership-dependent prices | Label as default logged-out price; link out |
| Legal/ToS | Pharmacy terms may restrict automated access; prefer affiliate feeds/partnerships where available; prominent disclaimers; no medical advice |
| Data volume (250k+ listings × sources) | Refresh tiers; latest price denormalized; monthly partitions for history |
