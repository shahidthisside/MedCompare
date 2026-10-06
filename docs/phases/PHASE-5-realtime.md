# Phase 5: Real-time Freshness

## Goal
Prices are always current: background refresh by tier, on-view refresh when stale, updates streamed into open pages, and live search across all pharmacy APIs for the user's city.

## Tasks
- [ ] Tier assignment job (hourly): hot/warm/cold from views, cart adds, search popularity (`ARCHITECTURE.md` freshness SLA).
- [ ] Refresh scheduler: enqueue due listings per tier within each source's budget; priority hot > warm > cold.
- [ ] View tracking: lightweight counter in Valkey (`INCR view:<productId>`), flushed to Postgres every 5 min. No personal data.
- [ ] On-view refresh: product page server code enqueues `live-refresh` for stale listings (BullMQ `jobId = listingId` dedupe, priority 1).
- [ ] Pub/sub: worker publishes `{listingId, pricePaise, mrpPaise, inStock, fetchedAt}` to `product:<id>`.
- [ ] SSE route `/api/live/[productId]`: subscribes, streams events, heartbeats every 15s, closes after 60s or when all pending refreshes are done.
- [ ] Client hook `useLivePrices(productId, initial)`: patches rows, `aria-live` announcements, falls back to polling if SSE fails.
- [ ] Live search: on every search, fan out to usable `search()` adapters (3s timeout each, cached 15 min), stream results, persist and match them.
- [ ] Discovery of new products: daily sitemap diff (new URLs → fetch with high priority).
- [ ] Failure UX: if a source fails during refresh, keep the last price, show "couldn't refresh · last updated 3h ago".

## Exit criteria
- Opening a page with stale prices shows refreshed prices within 10s (p90) without reload.
- 99% of hot listings younger than 4h; warm younger than 24h (dashboard query).
- Load test: 200 concurrent viewers of the same product cause at most 1 fetch per listing (dedupe works).

## Result
_(fill in)_
