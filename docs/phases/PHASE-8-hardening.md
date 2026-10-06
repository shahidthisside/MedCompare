# Phase 8: More Sources & Hardening

## Goal
Broader coverage and production-grade reliability.

## Tasks
### 8.1 P2/P3 sources (same adapter template + recon as Phase 0/2)
- [ ] platinumrx, dawaadost, medkart, genericaadhaar, davaindia (P2)
- [ ] zeelab, mrmed, sastasundar, healthmug (P3)
- [ ] Re-check deferred: medplus, wellnessforever, frankross, flipkarthealth. Add only if accessible without bypassing protection.
- [ ] Affiliate feed adapters if any program approval came through (preferred over scraping for that source).

### 8.2 Reliability
- [ ] Hourly canary health (`source_health`), `/status` page, alert (email/Telegram) on 3 consecutive failures.
- [ ] Auto-capture a fixture when a parse fails in production (gzipped, retained 14 days) to speed up fixes.
- [ ] Structured logs (pino) + OpenTelemetry traces across web → queue → worker; Sentry for errors.
- [ ] Postgres: monthly `price_point` partition creation job; retention policy (raw points 1 year, daily aggregates forever).

### 8.3 Security & performance review
- [ ] Dependency audit, CSP, security headers, rate-limit tests, admin routes behind auth, no secrets in client bundle.
- [ ] Load test (k6): 100 RPS mixed traffic, p95 page < 500 ms server time.
- [ ] Query review with `EXPLAIN ANALYZE` on hot paths.

## Exit criteria
- ≥10 sources live with passing health checks.
- k6 targets met; zero high/critical audit findings.
- Simulated adapter breakage (corrupt fixture) is caught by CI and by the health check.

## Result
_(fill in)_
