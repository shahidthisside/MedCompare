# Phase 6: Web App & Design System

## Goal
A fast, accessible, distinctive UI for all core screens, following `docs/DESIGN.md`.

## Tasks
### 6.1 Design system (`packages/ui`)
- [ ] Tailwind v4 theme tokens (colors, type scale, radii, spacing) in CSS variables; light + dark.
- [ ] shadcn/ui base components customised: Button, Input, Badge, Table, Tabs, Dialog, Sheet, Tooltip, Skeleton, Toast.
- [ ] Domain components: `PriceCell` (tabular, per-unit + pack), `FreshnessTag`, `SourceLogo` (text wordmark), `CompositionChips`, `SavingsBadge`, `RxBadge`, `WarningBadge`.
- [ ] Storybook or Ladle for components (optional but recommended).

### 6.2 Screens (`apps/web/app`)
- [ ] `/` Home: search combobox (cmdk) with instant results, recent searches (localStorage), popular medicines (from data).
- [ ] `/search?q=`: grouped results, filters (form, Rx/OTC, Jan Aushadhi), sort by price per unit.
- [ ] `/medicine/[slug]`: header, pack selector, live price table, substitutes, Jan Aushadhi block, history chart, add-to-cart. RSC + streaming (`Suspense`) + `useLivePrices`.
- [ ] `/salt/[slug]`: all brands for a composition.
- [ ] `/cart`: local cart (no login), compare matrix (calls `/api/cart/compare`).
- [ ] `/status`, `/about`, `/methodology`, `/disclaimer`, `/privacy`.
- [ ] Error, empty and loading states for every screen; 404 for unknown slugs with search suggestions.
- [ ] SEO: `generateMetadata`, JSON-LD (`Drug`/`Product` with `AggregateOffer`), sitemap.xml, robots.txt, canonical URLs, OG images via `next/og`.

### 6.3 Quality
- [ ] Playwright e2e: search → open medicine → see ≥3 sources → open substitute → add to cart → compare.
- [ ] axe checks in e2e; keyboard-only run-through.
- [ ] Lighthouse CI budgets: Performance ≥ 90 mobile, Accessibility 100, LCP < 2.0s, CLS < 0.05.

## Exit criteria
- All screens implemented with real data (no mocks in production code paths).
- e2e + axe + Lighthouse budgets pass in CI.
- Manual check at 360/768/1280px, light and dark.
- **MVP complete** (Phases 0–6): search any common Indian medicine and see current prices from ≥3 pharmacies plus cheaper substitutes.

## Result
_(fill in)_
