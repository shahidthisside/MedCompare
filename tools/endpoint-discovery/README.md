# Endpoint discovery tools

Two scripts that automate the Chrome DevTools → Network workflow for finding each pharmacy's live JSON APIs (rules in `docs/DATA_SOURCES.md`).
They use your installed Google Chrome via `playwright-core`; no browser download is needed.

```bash
cd tools/endpoint-discovery
npm install
```

## 1. `discover.mjs`: find search APIs automatically
Opens each site in Chrome, searches for a medicine, records every JSON fetch/XHR, picks the one that returns matching products with prices, then:
- saves it as a ready-to-run cURL (`candidate-N.curl.sh`), like "Copy as cURL"
- replays it outside the browser and removes headers one by one to find the **minimal working request** (`minimal.curl.sh`)
- explains auth headers: static app key vs. anonymous public JWT (with expiry and the endpoint that issues it)
- finds PIN/city/lat-lng fields and replays with **two locations** to check if prices differ

```bash
node discover.mjs                                  # all sites in sites.mjs
node discover.mjs --only apollo,medkart            # some sites
node discover.mjs --query "pan 40" --headed        # other medicine, visible browser
```
Output: `output/<site>/…` and `output/REPORT.md`. Takes ~1 min per site.

## 2. `test-curl.mjs`: test a cURL you copied yourself
In Chrome: DevTools → Network → **Fetch/XHR** → search on the site → right-click the request → **Copy → Copy as cURL (bash)**.

```bash
pbpaste | node test-curl.mjs --name pharmeasy
node test-curl.mjs --name pharmeasy --file req.txt --query dolo
node test-curl.mjs --name x --file req.txt --locations "Gurgaon:122001,Mumbai:400001,Bengaluru:560001"
```
Reports: minimal required headers, cookie dependence, token type/expiry, sample products, location fields, and price differences between locations. Output: `output/manual/<name>/`.

**Location tip:** if no location field is found, change the delivery PIN on the website, copy the same request again, and diff the two cURLs. Location is then usually in a cookie or a header.

## Safety
- `output/` is gitignored because it contains captured tokens (e.g. Apollo's public JWT, Netmeds' app key). Never commit it.
- Replays are spaced 1.2 s apart. Sites showing bot protection (403/429 challenge pages) are reported as `blocked` and skipped. The scripts do not try to get around them.

## Results: 2026-10-06, query "dolo 650"

| Site | Status | Endpoint | Required headers | Location |
|---|---|---|---|---|
| tata1mg | ✅ usable | `GET www.1mg.com/pwa-dweb-api/api/v4/search/all` | `x-city` | **City-sensitive**: 9/15 prices differ Gurgaon vs Mumbai |
| apollo | ✅ usable | `POST apigateway.apollo247.in/search-service/v5/fullSearch` | `authorization` (anonymous `PUBLIC_ACCESS_TOKEN` JWT, `public:read`, ~12h; issued by `GET apigateway.apollo247.in/auth-service/accessToken`), `content-type`, `x-source-service: PHARMA_AP_IN` | `pincode` in body: 1/6 differ |
| platinumrx | ✅ usable | `POST backend.platinumrx.in/pdp/v2/fetchPlp` | `content-type` | none found. Includes salt, manufacturer, pack qty, MRP, discounted price |
| medkart | ✅ usable | `GET app.medkart.in/api/v2/products/search?search=…` | none | none found |
| mrmed | ✅ usable | `GET api.mrmeds.in/search?search=…` | none | none found. Includes molecule, packing, price_to_customer |
| healthmug | ✅ usable | `POST api.healthmug.com/productlist/getproductlist` | `content-type` | none found |
| medplus | ✅ usable in browser replay | `GET www.medplusmart.com/mart-catalog-api/getProductSearchResults?searchCriteria=…` (query base64-encoded) | none | none found (plain curl to robots.txt was 403: re-verify stability) |
| truemeds | ✅ usable (added 2026-10-06 from your cURL) | `GET nal.tmmumbai.in/SearchService/getSearchSuggestion?searchString=…&warehouseId=40…` | none | none found. Includes salt list, manufacturer, pack, MRP, selling price |
| pharmeasy | ✅ usable, two-step | `GET pharmeasy.in/api/search/searchTypeAhead?q=…` (slugs, no prices) → product page `__NEXT_DATA__` (`salePrice`, `costPrice`, `molecule`) | none (`X-Pincode` cookie optional) | prices identical for 3 PINs tested |
| netmeds (search) | ✅ usable | `GET www.netmeds.com/ext/search/application/api/v1.0/products?page_id=*&q=…` | `authorization` (static app key); the `x-fp-signature` header from the browser is **not** required, so nothing to forge | `x-location-detail` PIN: no price difference 110001 vs 400001 |
| netmeds (batch price) | ⚠ partial | `POST www.netmeds.com/api/service/application/catalog/v1.0/products/sizes/price` (price by slug, not search) | `authorization` (static base64 `appId:secret` app key from site JS) | none found. Search itself is server-rendered → slugs via sitemap + this batch price API |
| dawaadost, davaindia, zeelab, sastasundar | ❌ no JSON search seen | likely server-rendered | - | product pages, or paste a cURL |
| genericaadhaar | ❌ search box not found | - | - | Paste a cURL manually |
| wellnessforever | 🚫 blocked (Vercel Security Checkpoint) | - | - | Skip |
