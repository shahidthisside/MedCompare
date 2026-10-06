// Pharmacy adapters. Each adapter = request (server-side fetch) + pure parse (fixture-tested).
// Endpoints and required headers were found with tools/endpoint-discovery (see its README).

import { isPlaceholderImage, parseForm, parsePack, stripHtml, toPaise } from '../parse.ts';
import type { Listing, SourceId, UserLocation } from '../types.ts';

import { SOURCE_BY_ID, type SourceMeta } from './meta.ts';

export interface Adapter extends SourceMeta {
  fetch(query: string, loc: UserLocation, signal: AbortSignal): Promise<unknown>;
  parse(json: unknown, query: string): Listing[];
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

async function getJson(url: string, init: RequestInit & { signal: AbortSignal }): Promise<unknown> {
  const res = await fetch(url, { ...init, headers: { 'user-agent': UA, accept: 'application/json', ...(init.headers ?? {}) }, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try {
    const parsed: unknown = JSON.parse(text);
    // Some APIs (Healthmug) return JSON encoded as a JSON string depending on the Accept header.
    return typeof parsed === 'string' && /^[[{]/.test(parsed.trim()) ? JSON.parse(parsed) : parsed;
  } catch {
    throw new Error('Non-JSON response (blocked?)');
  }
}

// Loose accessors for untyped JSON.
type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === 'object' && !Array.isArray(v) ? (v as J) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined);
const at = (v: unknown, ...path: string[]): unknown => path.reduce<unknown>((o, k) => obj(o)[k], v);

function finalize(l: Omit<Listing, 'pricePaise'> & { pricePaise?: number }): Listing | undefined {
  const pricePaise = l.pricePaise ?? l.mrpPaise;
  if (!pricePaise || !l.name) return undefined;
  const mrpPaise = l.mrpPaise && l.mrpPaise >= pricePaise ? l.mrpPaise : undefined;
  return { ...l, name: stripHtml(l.name), pricePaise, mrpPaise, imageUrl: isPlaceholderImage(l.imageUrl) ? undefined : l.imageUrl };
}
/** Apollo thumbnails already start with /catalog/product/…; prefixing it twice makes the CDN serve its grey "no photo" logo. */
export function apolloImage(thumb: string | undefined): string | undefined {
  if (!thumb) return undefined;
  const path = thumb.startsWith('http') ? thumb : `/${thumb.replace(/^\/+/, '').replace(/^catalog\/product\//, '')}`;
  return path.startsWith('http') ? path : `https://images.apollo247.in/pub/media/catalog/product${path}`;
}
const compact = <T>(xs: (T | undefined)[]): T[] => xs.filter((x): x is T => x !== undefined);

/** 1mg uses its own city names; map common variants. Unknown cities still work (fall back to a default price). */
export function oneMgCity(city: string): string {
  const c = city.trim().toLowerCase();
  const map: Record<string, string> = {
    gurugram: 'Gurgaon', gurgaon: 'Gurgaon', bengaluru: 'Bangalore', bangalore: 'Bangalore', delhi: 'New Delhi', 'new delhi': 'New Delhi',
    'mumbai city': 'Mumbai', 'mumbai suburban': 'Mumbai', mumbai: 'Mumbai', 'gautam buddha nagar': 'Noida', noida: 'Noida', 'rangareddy': 'Hyderabad', 'medchal malkajgiri': 'Hyderabad',
    kolkata: 'Kolkata', chennai: 'Chennai', pune: 'Pune', hyderabad: 'Hyderabad', ghaziabad: 'Ghaziabad', faridabad: 'Faridabad',
  };
  return map[c] ?? city.replace(/\b\w/g, (m) => m.toUpperCase());
}

// ---------------------------------------------------------------- Tata 1mg
const tata1mg: Adapter = {
  ...SOURCE_BY_ID.tata1mg,
  fetch(q, loc, signal) {
    const city = oneMgCity(loc.city);
    const u = new URL('https://www.1mg.com/pwa-dweb-api/api/v4/search/all');
    Object.entries({ q, city, page_number: '0', per_page: '30', types: 'sku,allopathy', sort: 'relevance', fetch_eta: 'true', is_city_serviceable: 'true' }).forEach(([k, v]) => u.searchParams.set(k, v));
    return getJson(u.toString(), { signal, headers: { 'x-city': city } });
  },
  parse(json) {
    return compact(
      arr(at(json, 'data', 'search_results')).map((r) => {
        const o = obj(r);
        const url = str(o.url);
        if (!url || !['drug', 'allopathy', 'otc'].includes(String(o.type))) return undefined;
        const prices = obj(o.prices);
        const label = str(o.label);
        const pack = parsePack(label);
        return finalize({
          source: 'tata1mg', id: String(o.id ?? url), name: str(o.name) ?? '', url: `https://www.1mg.com${url}`,
          imageUrl: str(o.image) ?? str(arr(o.cropped_image_urls)[0]),
          packLabel: label, units: pack?.units, unitType: pack?.unitType, form: parseForm(str(o.name), label),
          mrpPaise: toPaise(prices.mrp), pricePaise: toPaise(prices.discounted_price) ?? toPaise(prices.mrp),
          inStock: o.available !== false, rxRequired: o.rx_required === true, eta: str(o.eta) && stripHtml(String(o.eta)),
        });
      }),
    );
  },
};

// ---------------------------------------------------------------- Apollo 24|7
let apolloToken: { value: string; exp: number } | undefined;
async function getApolloToken(signal: AbortSignal): Promise<string> {
  if (apolloToken && apolloToken.exp > Date.now() + 60_000) return apolloToken.value;
  // Anonymous public token (scope public:read) that apollopharmacy.in issues to every visitor.
  const j = obj(await getJson('https://apigateway.apollo247.in/auth-service/accessToken', { signal, headers: { origin: 'https://www.apollopharmacy.in', referer: 'https://www.apollopharmacy.in/' } }));
  const value = str(j.accessToken);
  if (!value) throw new Error('No Apollo token');
  apolloToken = { value, exp: Date.now() + (Number(j.ttlInMinutes) || 60) * 60_000 * 0.9 };
  return value;
}
const apollo: Adapter = {
  ...SOURCE_BY_ID.apollo,
  async fetch(q, loc, signal) {
    const send = async () =>
      getJson('https://apigateway.apollo247.in/search-service/v5/fullSearch', {
        signal, method: 'POST',
        headers: { authorization: await getApolloToken(signal), 'content-type': 'application/json', 'x-source-service': 'PHARMA_AP_IN', origin: 'https://www.apollopharmacy.in' },
        body: JSON.stringify({ query: q, page: 1, productsPerPage: 24, selSortBy: 'relevance', filters: [], pincode: loc.pin }),
      });
    try {
      return await send();
    } catch (e) {
      if (String(e).includes('401')) { apolloToken = undefined; return send(); }
      throw e;
    }
  },
  parse(json) {
    return compact(
      arr(at(json, 'data', 'productDetails', 'products')).map((r) => {
        const o = obj(r);
        const name = str(o.name) ?? '';
        const pack = parsePack(name);
        const rx = Number(o.isPrescriptionRequired) === 1;
        const tat = obj(o.tatResponse);
        return finalize({
          source: 'apollo', id: str(o.sku) ?? name, name,
          url: `https://www.apollopharmacy.in/${rx ? 'medicine' : 'otc'}/${str(o.urlKey) ?? ''}`,
          imageUrl: apolloImage(str(o.thumbnail)),
          packLabel: pack ? `${pack.units} ${pack.unitType === 'ml' ? 'ml' : pack.unitType === 'cap' ? 'capsules' : 'tablets'}` : undefined,
          units: pack?.units, unitType: pack?.unitType, form: parseForm(name),
          mrpPaise: toPaise(o.price), pricePaise: toPaise(o.specialPrice) ?? toPaise(o.price),
          inStock: String(o.status) === 'in-stock', rxRequired: rx,
          eta: str(tat.value) ? `${tat.name === 'SAME_DAY' ? 'Today' : 'In'} ${tat.value}` : undefined,
        });
      }),
    );
  },
};

// ---------------------------------------------------------------- PlatinumRx
const platinumrx: Adapter = {
  ...SOURCE_BY_ID.platinumrx,
  fetch(q, _loc, signal) {
    return getJson('https://backend.platinumrx.in/pdp/v2/fetchPlp', { signal, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ searchText: q, fetchBestOfferPrice: true }) });
  },
  parse(json) {
    return compact(
      arr(at(json, 'data', 'plpData')).map((r) => {
        const o = obj(obj(r).masterItemData);
        const name = str(o.displayName) ?? '';
        const uom = (str(o.unitOfMeasurement) ?? '').toLowerCase();
        const qty = Number(o.packQuantityValueDecimal) || undefined;
        const unitType: Listing['unitType'] = /ml/.test(uom) ? 'ml' : /cap/.test(uom) ? 'cap' : /tab/.test(uom) ? 'tab' : /gm|g\b/.test(uom) ? 'g' : 'unit';
        const isRx = /^rx$/i.test(str(o.drugCategory) ?? '');
        return finalize({
          source: 'platinumrx', id: String(o.masterDrugCode ?? o.id ?? name), name,
          url: `https://www.platinumrx.in/${isRx ? 'medicines' : 'otc'}/${str(o.urlName) ?? ''}/${o.masterDrugCode ?? ''}`,
          imageUrl: str(o.heroImage), manufacturer: str(o.manufacturerName), composition: str(o.saltComposition),
          form: parseForm(str(o.drugForm), name), packLabel: qty ? `${qty} ${uom}` : undefined, units: qty, unitType,
          mrpPaise: toPaise(o.mrp), pricePaise: toPaise(o.discountedPrice) ?? toPaise(o.mrp),
          inStock: o.banned !== true, rxRequired: isRx,
        });
      }),
    );
  },
};

// ---------------------------------------------------------------- Medkart
const medkart: Adapter = {
  ...SOURCE_BY_ID.medkart,
  fetch(q, _loc, signal) {
    return getJson(`https://app.medkart.in/api/v2/products/search?search=${encodeURIComponent(q)}&page=1`, { signal });
  },
  parse(json) {
    return compact(
      arr(at(json, 'data', 'products')).map((r) => {
        const o = obj(r);
        if (o.is_banned === true || o.is_discontinued === true) return undefined;
        const name = str(o.name_web) ?? str(o.name) ?? '';
        const pack = parsePack(name, str(o.name));
        const size = Number(o.package_size) || pack?.units;
        const mkUnit: Listing['unitType'] = pack?.unitType ?? (parseForm(str(o.content), name) === 'tablet' ? 'tab' : parseForm(str(o.content), name) === 'capsule' ? 'cap' : 'unit');
        return finalize({
          source: 'medkart', id: String(o.id ?? o.slug), name, url: `https://www.medkart.in/order-medicine/${str(o.slug) ?? ''}`,
          imageUrl: str(obj(arr(o.images)[0]).url)?.replace(/ /g, '%20'), manufacturer: str(o.manufacturer_name), composition: str(o.combinations),
          form: parseForm(str(o.content), name), packLabel: size ? `${size} ${({ tab: 'tablets', cap: 'capsules', ml: 'ml', g: 'g', unit: 'units' } as const)[mkUnit]}` : undefined,
          units: size, unitType: mkUnit,
          mrpPaise: toPaise(o.mrp), pricePaise: toPaise(o.sales_price) ?? toPaise(o.mrp),
          inStock: o.can_sell_online !== false && o.is_live !== false, rxRequired: o.is_rx_required === true,
        });
      }),
    );
  },
};

// ---------------------------------------------------------------- MrMed
const mrmed: Adapter = {
  ...SOURCE_BY_ID.mrmed,
  fetch(q, _loc, signal) {
    return getJson(`https://api.mrmeds.in/search?search=${encodeURIComponent(q)}&page=1&limit=20`, { signal });
  },
  parse(json) {
    return compact(
      arr(at(json, 'data', 'products', 'data', 'products')).map((r) => {
        const o = obj(r);
        const name = str(o.product_name) ?? '';
        const packing = str(o.packing_display);
        const pack = parsePack(packing, name);
        const molecule = str(o.molecule_name);
        const strength = str(o.product_strength);
        return finalize({
          source: 'mrmed', id: String(o.productId ?? o._id ?? o.slug), name, url: `https://www.mrmed.in/medicines/${str(o.slug) ?? ''}`,
          imageUrl: str(obj(arr(o.image)[0]).link), manufacturer: str(o.manufacturer),
          composition: molecule ? `${molecule}${strength ? ` ${strength}` : ''}` : undefined,
          form: parseForm(str(o.dosage_form), name), packLabel: packing?.toLowerCase(), units: pack?.units, unitType: pack?.unitType,
          mrpPaise: toPaise(o.mrp), pricePaise: toPaise(o.price_to_customer) ?? toPaise(o.mrp),
          inStock: obj(o.stock).stock !== false, rxRequired: o.rx_required === true,
        });
      }),
    );
  },
};

// ---------------------------------------------------------------- Healthmug
const healthmug: Adapter = {
  ...SOURCE_BY_ID.healthmug,
  fetch(q, _loc, signal) {
    return getJson('https://api.healthmug.com/productlist/getproductlist', {
      signal, method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ atts: '', price: '', brand: '', sortby: -1, keywords: q, delivery: '', pagetype: 'search', pageno: 1, disease_id: '', categoryid: '', appstring: 'Desktop - v2.0', rating: '', weight: '' }),
    });
  },
  parse(json) {
    return compact(
      arr(at(json, 'itemlist', 'items')).map((r) => {
        const o = obj(r);
        const name = str(o.name) ?? '';
        const variant = str(o.variant_size);
        const pack = parsePack(variant, name);
        const img = str(arr(o.images)[0]);
        return finalize({
          source: 'healthmug', id: String(o.id ?? name), name, url: `https://www.healthmug.com${str(o.url) ?? ''}`,
          imageUrl: img ? `https://www.healthmug.com/images/product/${img}.jpg` : undefined,
          form: parseForm(name, variant), packLabel: variant, units: pack?.units, unitType: pack?.unitType,
          mrpPaise: toPaise(o.mrp), pricePaise: toPaise(o.price) ?? toPaise(o.mrp),
          inStock: o.not_deliverable !== true && Number(o.quantity ?? 1) > 0, rxRequired: o.prescription_required === true,
        });
      }),
    );
  },
};

// ---------------------------------------------------------------- MedPlus
const medplus: Adapter = {
  ...SOURCE_BY_ID.medplus,
  fetch(q, _loc, signal) {
    const criteria = JSON.stringify({ searchQuery: Buffer.from(`A::${q}`).toString('base64'), recordsCount: 20, allFieldsRequired: true });
    return getJson(`https://www.medplusmart.com/mart-catalog-api/getProductSearchResults?searchCriteria=${encodeURIComponent(criteria)}`, { signal });
  },
  parse(json, query) {
    return compact(
      arr(at(json, 'dataObject', 'products')).map((r) => {
        const o = obj(r);
        const name = str(o.productName) ?? '';
        const attr = obj(o.attribute);
        const size = Number(attr.packSize) || undefined;
        const form = parseForm(str(o.auditFormSubName), str(attr.auditForm), name);
        const unitType: Listing['unitType'] = form === 'tablet' ? 'tab' : form === 'capsule' ? 'cap' : /syrup|suspension|drops|solution|injection/.test(form ?? '') ? 'ml' : 'unit';
        return finalize({
          source: 'medplus', id: String(o.productId ?? name), name,
          url: `https://www.medplusmart.com/searchAll/${encodeURIComponent(query)}`,
          imageUrl: str(o.imageUrl), manufacturer: str(o.manufacturer), composition: str(o.compositionName), form,
          packLabel: size ? `${size} ${unitType === 'tab' ? 'tablets' : unitType === 'cap' ? 'capsules' : unitType}` : undefined, units: size, unitType,
          mrpPaise: toPaise(o.mrpPrice), pricePaise: toPaise(o.discountedPrice) ?? toPaise(o.mrpPrice),
          inStock: o.isInStock !== false,
        });
      }),
    );
  },
};

// ---------------------------------------------------------------- Truemeds
const truemeds: Adapter = {
  ...SOURCE_BY_ID.truemeds,
  fetch(q, _loc, signal) {
    const u = new URL('https://nal.tmmumbai.in/SearchService/getSearchSuggestion');
    Object.entries({ searchString: q, isMultiSearch: 'true', elasticSearchType: 'SEARCH_SUGGESTION', warehouseId: '40', variantId: '18', searchVariant: 'N', orderConfirmSrc: 'WEBSITE', sourceVersion: 'TM_WEBSITE_V_4.28.14' }).forEach(([k, v]) => u.searchParams.set(k, v));
    return getJson(u.toString(), { signal, headers: { origin: 'https://www.truemeds.in', referer: 'https://www.truemeds.in/', 'client-platform': 'WEBSITE' } });
  },
  parse(json) {
    return compact(
      arr(at(json, 'responseData', 'productList')).map((r) => {
        const o = obj(obj(r).product);
        const name = str(o.skuName) ?? '';
        const size = Number(o.packSize) || undefined;
        const form = parseForm(name, str(o.packForm));
        const pack = parsePack(str(o.packForm), name);
        const unitType: Listing['unitType'] = pack?.unitType && pack.unitType !== 'unit' ? pack.unitType : form === 'tablet' ? 'tab' : form === 'capsule' ? 'cap' : /syrup|suspension|solution|drops/.test(form ?? '') ? 'ml' : 'unit';
        const salts = arr(o.saltComposition).map((x) => obj(x)).map((x) => `${str(x.saltName) ?? ''} ${str(x.quantity) ?? ''}`.trim()).filter(Boolean);
        return finalize({
          source: 'truemeds', id: str(o.productCode) ?? name, name,
          url: `https://www.truemeds.in/${str(o.productUrlSuffix) ?? ''}`,
          imageUrl: str(arr(o.productImageUrlArray)[0]), manufacturer: str(o.manufacturerName),
          composition: salts.join(' + ') || str(o.composition), form,
          packLabel: str(o.packForm)?.toLowerCase(), units: size ?? pack?.units, unitType,
          mrpPaise: toPaise(o.mrp), pricePaise: toPaise(o.sellingPrice) ?? toPaise(o.mrp),
          inStock: o.available !== false && o.is_oos !== true, rxRequired: o.rxRequired === true,
        });
      }),
    );
  },
};

// ---------------------------------------------------------------- Netmeds
// Search API needs only the storefront app key that netmeds.com ships to every visitor (no signature needed for search).
const NETMEDS_APP_KEY = 'Bearer NjVmNTYyYzE1MDRhNTlhNjdmNTI5YWQ0Ol9VLW9oSTRJeQ==';
const netmeds: Adapter = {
  ...SOURCE_BY_ID.netmeds,
  fetch(q, loc, signal) {
    return getJson(`https://www.netmeds.com/ext/search/application/api/v1.0/products?page_id=*&page_size=24&q=${encodeURIComponent(q)}`, {
      signal,
      headers: { authorization: NETMEDS_APP_KEY, 'x-currency-code': 'INR', 'x-location-detail': JSON.stringify({ country: 'INDIA', country_iso_code: 'IN', pincode: loc.pin, city: loc.city }) },
    });
  },
  parse(json) {
    return compact(
      arr(obj(json).items).map((r) => {
        const o = obj(r);
        if (o.type !== 'product') return undefined;
        const a = obj(o.attributes);
        const price = obj(o.price);
        const name = str(o.name) ?? '';
        const label = str(a['mstar-packlabel']);
        const pack = parsePack(label, name);
        return finalize({
          source: 'netmeds', id: String(o.uid ?? o.slug), name, url: `https://www.netmeds.com/product/${str(o.slug) ?? ''}`,
          imageUrl: str(obj(arr(o.medias)[0]).url), manufacturer: str(a.manufacturername), composition: str(a.genericname),
          form: parseForm(name, label), packLabel: label?.toLowerCase(), units: Number(a.packsize) || pack?.units, unitType: pack?.unitType ?? (parseForm(name) === 'tablet' ? 'tab' : 'unit'),
          mrpPaise: toPaise(obj(price.marked).min), pricePaise: toPaise(obj(price.effective).min) ?? toPaise(obj(price.marked).min),
          inStock: o.sellable !== false, rxRequired: /^rx required/i.test(str(a['mstar-rxrequired']) ?? ''),
        });
      }),
    );
  },
};

// ---------------------------------------------------------------- PharmEasy
// Type-ahead gives product slugs (no prices); prices come from each product page's __NEXT_DATA__ (product pages are robots-allowed).
const PE_PAGES = 6;
const pharmeasy: Adapter = {
  ...SOURCE_BY_ID.pharmeasy,
  async fetch(q, loc, signal) {
    const ta = obj(await getJson(`https://pharmeasy.in/api/search/searchTypeAhead?q=${encodeURIComponent(q)}`, { signal, headers: { cookie: `X-Pincode=${loc.pin}` } }));
    const slugs = arr(at(ta, 'data', 'products')).map(obj).filter((p) => Number(p.entityType) === 2 && str(p.slug)).slice(0, PE_PAGES).map((p) => String(p.slug));
    const pages = await Promise.allSettled(
      slugs.map(async (slug) => {
        const res = await fetch(`https://pharmeasy.in/online-medicine-order/${slug}`, { signal, headers: { 'user-agent': UA, cookie: `X-Pincode=${loc.pin}` }, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const m = (await res.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        return m ? { slug, details: at(JSON.parse(m[1] ?? '{}'), 'props', 'pageProps', 'productDetails') } : undefined;
      }),
    );
    return pages.flatMap((p) => (p.status === 'fulfilled' && p.value ? [p.value] : []));
  },
  parse(json) {
    return compact(
      arr(json).map((r) => {
        const { slug, details } = obj(r) as { slug?: string; details?: unknown };
        const o = obj(details);
        const name = str(o.name) ?? '';
        const measure = str(o.measurementUnit);
        const pack = parsePack(measure, name);
        const img = str(arr(o.images)[0]) ?? str(obj(arr(o.damImages)[0]).url);
        return finalize({
          source: 'pharmeasy', id: String(o.productId ?? slug), name, url: `https://pharmeasy.in/online-medicine-order/${slug ?? ''}`,
          imageUrl: img, manufacturer: str(o.manufacturer), composition: str(o.molecule),
          form: parseForm(name, measure), packLabel: measure?.toLowerCase(), units: pack?.units, unitType: pack?.unitType,
          mrpPaise: toPaise(o.costPrice), pricePaise: toPaise(o.salePrice) ?? toPaise(o.costPrice),
          inStock: o.isAvailable !== false, rxRequired: o.isRxRequired === true,
        });
      }),
    );
  },
};

export const ADAPTERS: Record<SourceId, Adapter> = { tata1mg, pharmeasy, netmeds, apollo, truemeds, platinumrx, medkart, mrmed, healthmug, medplus };
export const SOURCE_IDS = Object.keys(ADAPTERS) as SourceId[];
