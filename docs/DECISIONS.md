# Decisions (ADR log)

One entry per decision: date, decision, alternatives, reason.

## 2026-10-06: Full rewrite in TypeScript monorepo
Replaced Flask + static HTML with Next.js + worker monorepo. Alternatives: Python (FastAPI + Scrapy) backend with React frontend. Chosen: single language, shared Zod types between crawler and UI, Crawlee covers crawling needs. Python remains an option for PDF table extraction (NPPA) as a standalone script if JS tooling is insufficient.

## 2026-10-06: Own catalog + continuous refresh instead of live scraping per search
Live-scraping every pharmacy on each search is slow (3–10s), fragile, and hits robots-disallowed search paths. Our own index gives instant search; tiered and on-view refresh keeps prices current. Live search APIs run on every search for real-time city prices; the catalog makes search instant and stores history.

## 2026-10-06: Two fetch methods, both always on
Live JSON APIs (public endpoints found via DevTools / `tools/endpoint-discovery`) are primary because they are real-time and city-specific. Product pages via sitemaps are the fallback for sources without a usable API and fill missing fields. Bypassing bot protection, forging signed tokens and reusing logged-in sessions are excluded.

## Pending (Phase 0)
- Exact pinned versions of all tools.
- Project license (MIT vs AGPL-3.0).
- Hosting provider.
