# Phase 9: Deploy & Launch

## Goal
MedCompare running in production, monitored, backed up and discoverable.

## Tasks
- [ ] Dockerfiles for `web` and `worker` (multi-stage, non-root, healthchecks).
- [ ] Infra: web on Vercel (or Docker on the same VPS); worker + Postgres + Valkey + Meilisearch on a VPS (e.g. 4 vCPU / 8 GB) or Railway/Fly. Decide in DECISIONS.md with cost estimate (check providers' pricing pages).
- [ ] TLS, domain, production rate limits and cache TTLs per source.
- [ ] Nightly Postgres backups (pg_dump → object storage) + tested restore; Meilisearch rebuildable from Postgres.
- [ ] Uptime monitoring (web, API, worker heartbeat), error alerting.
- [ ] Privacy-friendly analytics (Umami/Plausible self-hosted) or none.
- [ ] SEO launch: submit sitemap, verify structured data, salt and medicine pages indexable.
- [ ] Hindi locale (`next-intl`) for UI strings; medicine names stay as listed.
- [ ] Legal pages finalised: disclaimer (not medical advice, prices indicative), privacy (DPDP), affiliate disclosure, source attribution, takedown contact.
- [ ] README: architecture, setup, commands, data-source policy.

## Exit criteria
- Production URL live; e2e suite passes against production.
- Restore drill succeeds.
- 7 days of uptime with all P1 sources healthy and freshness SLA met.

## Result
_(fill in)_
