# Design Direction

Goal: a calm, trustworthy, information-dense tool, like a good fintech comparison app. No generic "AI template" look.

## Avoid
- Purple/blue gradients, glassmorphism, glowing blobs, emoji headings, stock "doctor smiling" images.
- Hero sections with vague slogans. The search box **is** the hero.
- Card grids of features with icons in circles.
- Centered everything; giant rounded-3xl cards with drop shadows.

## Principles
1. **Search first.** Home page has a large search input with instant results (≤100 ms from Meilisearch), recent searches, and 6 popular medicines pulled from real traffic.
2. **Numbers are the UI.** Prices use tabular numerals, are right-aligned, and show per-unit price prominently with pack price secondary. Cheapest row gets a subtle highlight plus "Lowest" label (not only color).
3. **Honest freshness.** "Updated 8 min ago · 1mg". Stale rows are dimmed with a refresh spinner.
4. **Trust signals:** source links, "Prices are logged-out default prices and may vary by PIN code/coupons", NPPA ceiling and Jan Aushadhi data labelled as official government sources.
5. **Mobile first.** Most users are on Android phones, often on slow networks. Target LCP < 2.0s on 4G, JS budget < 150 KB on medicine pages.

## Visual system
- **Type:** Inter or Geist Sans for UI, plus tabular-nums for prices. Scale 12/14/16/20/24/32.
- **Color:** neutral zinc/stone base; one brand accent, deep teal (`#0F766E` range); success green for savings; amber for warnings (ceiling exceeded, banned FDC); red reserved for errors. Full dark mode.
- **Shape:** radius 8px (inputs/buttons), 12px (panels). Borders over shadows.
- **Density:** comparison tables, not cards, on ≥768px; stacked rows on mobile.
- **Motion:** only functional (row price updates fade-flash once; skeletons while loading). Respect `prefers-reduced-motion`.
- **Language:** English first; i18n-ready (Hindi in Phase 9) via `next-intl`.

## Key screens
1. **Home**: search, recent searches, "How it works" in 3 lines, data-source logos (text), trust note.
2. **Search results**: grouped by product; each row shows brand, manufacturer, composition, form, lowest price per unit across sources, and number of sources.
3. **Medicine page** `/medicine/[slug]`:
   - Header: brand, composition chips (link to salt page), manufacturer, Rx badge, NLEM/Jan Aushadhi/banned badges.
   - Pack selector (10 / 15 / 30).
   - **Price table**: pharmacy, pack price, per-unit price, MRP and discount %, stock, updated-ago, "Buy on X ↗".
   - **Cheaper substitutes**: same composition, sorted by per-unit price, with savings %. Disclaimer inline.
   - **Jan Aushadhi equivalent**: MRP plus nearest Kendra by PIN.
   - **Price history** chart (per source, 90 days).
   - "Add to cart" (compare cart).
4. **Salt page** `/salt/[slug]`: all brands for a composition, sorted by price per unit.
5. **Cart compare** `/cart`: items × pharmacies matrix; best single pharmacy and best split; missing items clearly marked.
6. **Status** `/status`: source health and last successful crawl per source.
7. **About / methodology / disclaimer / privacy.**

## Accessibility
WCAG 2.2 AA: contrast ≥ 4.5:1, focus rings visible, full keyboard support for search combobox (ARIA combobox pattern via Radix/cmdk), table semantics for price tables, `aria-live="polite"` for streamed price updates, and labels never conveyed by color alone.
