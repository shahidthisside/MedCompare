# Tata 1mg: Endpoints (live API)

## Search: `GET /pwa-dweb-api/api/v4/search/all`
Verified 2026-10-06. **Status: usable** (no cookies, no auth, no signed token).

```bash
curl -s -H "x-city: Gurgaon" \
  'https://www.1mg.com/pwa-dweb-api/api/v4/search/all?q=dolo%20650&city=Gurgaon&page_number=0&per_page=10&types=sku,allopathy'
```

| Param / header | Required | Notes |
|---|---|---|
| `x-city` **header** | **yes** | Without it: `400 {"error":{"message":"City is required"}}`. The `city` query param alone is not enough. A city cookie does not work either |
| `q` | yes | Search term |
| `city` | send it | Keep in sync with `x-city` |
| `page_number` | no | 0-based |
| `per_page` | no | 10 requested, but the API returned 25–35 result objects (it mixes in chips/ads) |
| `types` | no | `sku,allopathy` |
| `scroll_id` | no | Returned in `data.scroll_id`; for pagination |
| `sort`, `filter`, `fetch_eta`, `is_city_serviceable` | no | Optional |
| User-Agent / Referer | no | Worked without either (still send an honest UA) |

### Response (relevant parts)
```text
data.term
data.scroll_id
data.search_results[]          # mixed: product rows + "chip"/ad rows
  .id            "63631"       # string or number; also appears as sku_id in nested objects
  .name          "Dolo 650 Tablet"   # may contain <b>…</b> highlight tags → strip
  .label         "15 tablets"  # pack label
  .type          drug | allopathy | otc | chip
  .url           "/drugs/dolo-650-tablet-74467"   # relative; prefix https://www.1mg.com
  .available     true/false
  .rx_required   bool
  .prices.mrp               "₹32.28"
  .prices.discounted_price  "₹28.3" | null (null → selling price = MRP)
  .prices.discount          "9% off" | null
  .prices.best_price.tags[].mix_panel_data.{sku_mrp, sku_list_price, sku_coupon_price, sku_best_price}  # numeric; coupon price needs a min order value, so do not show as the price
  .quantity_info.selling_quantity
  .eta           delivery ETA HTML
  .generic_substitute       null in samples
```
- No composition or manufacturer in search results. Get those from the product page (`/drugs/<slug>` → `window.__INITIAL_STATE__`) once per product and cache.
- Filter rows: keep `type ∈ {drug, allopathy, otc}` with a `url`.

### Key finding: price depends on city
Same query and moment, Dolo 650 (15 tablets): Gurgaon ₹28.30, Mumbai ₹30.60 (MRP ₹32.28 both). So:
- `city` is part of the cache key and of every `price_point`.
- The UI needs a city/PIN selector (default from the browser's coarse location or "Delhi NCR"); show "Prices for <city>".

### Fixtures
`fixtures/search-paracetamol-gurgaon.json.gz`, `search-dolo650-gurgaon.json.gz`, `search-dolo650-mumbai.json.gz`

### Limits observed
4 requests at ~2s spacing with no throttling seen. Use max 1 req/s and cache 15 min per (q, city).
