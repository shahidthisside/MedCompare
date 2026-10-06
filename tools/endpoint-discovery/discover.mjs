#!/usr/bin/env node
// Endpoint discovery: automates what you do by hand in Chrome DevTools > Network > Fetch/XHR.
//
// For each pharmacy site:
//   1. Opens the site's search in real Chrome (no stealth tricks, no CAPTCHA solving) and records every JSON fetch/XHR.
//   2. Scores responses that look like medicine search results (query term present + price-like keys).
//   3. Saves the best candidate as a ready-to-run cURL command (same as "Copy as cURL").
//   4. Replays it outside the browser and strips headers one at a time to find the minimal working request,
//      reporting which headers are required (e.g. x-city on 1mg) and whether session cookies are needed.
//   5. Finds location fields (PIN, city, lat/lng) in the request and replays with two locations to check whether prices change.
//
// Usage:  node discover.mjs [--only tata1mg,pharmeasy] [--query "dolo 650"] [--headed]
// Output: output/<site>/{candidate-*.curl.sh, candidate-*.json, minimal.curl.sh, location-*.json} and output/REPORT.md
//
// Rules: docs/DATA_SOURCES.md (Live API).

import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SITES, LOCATIONS } from './sites.mjs';

const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
let QUERY = argVal('--query', 'dolo 650');
export const setQuery = (q) => { QUERY = q; };
const ONLY = argVal('--only', '')?.split(',').filter(Boolean);
const HEADED = args.includes('--headed');
const OUT = path.resolve('output');
const REPLAY_DELAY_MS = 1200; // politeness between replay requests
const MAX_BODY = 3_000_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PRICE_KEY = /^(price|mrp|selling_?price|sale_?price|salePrice|sellingPrice|discounted_?price|discountedPrice|offer_?price|offerPrice|final_?price|finalPrice|special_?price|list_?price|price_?mrp|mrpPrice)$/i;
const NAME_KEY = /^(name|title|product_?name|productName|display_?name|displayName|medicine_?name|sku_?name|skuName)$/i;
const DROP_HEADERS = new Set(['host', 'connection', 'content-length', 'accept-encoding', 'cookie']);
const CITY_NAMES = ['gurgaon', 'gurugram', 'delhi', 'new delhi', 'mumbai', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'noida'];

// ---------- JSON helpers ----------
function tryJson(text) {
  try { return JSON.parse(text); } catch { return undefined; }
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[₹,\s]|Rs\.?/gi, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

// Walks a JSON value and returns objects that look like products: {name, prices{key:number}}.
function extractProducts(json, limit = 200) {
  const out = [];
  const seen = new Set();
  const walk = (o, depth) => {
    if (!o || depth > 12 || out.length >= limit) return;
    if (Array.isArray(o)) { for (const v of o) walk(v, depth + 1); return; }
    if (typeof o !== 'object') return;
    const keys = Object.keys(o);
    const nameKey = keys.find((k) => NAME_KEY.test(k) && typeof o[k] === 'string');
    const prices = {};
    const collect = (obj, prefix) => {
      for (const [k, v] of Object.entries(obj)) {
        if (PRICE_KEY.test(k)) { const n = toNumber(v); if (n !== undefined && n > 0) prices[prefix + k] = n; }
      }
    };
    collect(o, '');
    for (const k of keys) if (/price/i.test(k) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) collect(o[k], `${k}.`);
    if (nameKey && Object.keys(prices).length) {
      const name = o[nameKey].replace(/<[^>]+>/g, '').trim();
      const sig = name + JSON.stringify(prices);
      if (!seen.has(sig)) { seen.add(sig); out.push({ name, prices }); }
    }
    for (const k of keys) walk(o[k], depth + 1);
  };
  walk(json, 0);
  return out;
}

function scoreResponse(rec) {
  const json = tryJson(rec.body);
  if (json === undefined) return { score: 0, products: [] };
  const q = QUERY.split(/\s+/)[0].toLowerCase();
  // Only products whose name contains the query term count, which filters out homepage/recommendation feeds.
  const products = extractProducts(json).filter((p) => p.name.toLowerCase().includes(q));
  const mentions = rec.body.toLowerCase().split(q).length - 1;
  const urlHint = /search|suggest|autocomplete|product|catalog|listing|sku/i.test(rec.url) ? 5 : 0;
  const score = products.length * 3 + Math.min(mentions, 20) + urlHint;
  return { score: products.length ? score : 0, products };
}

// ---------- cURL ----------
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
function toCurl({ method, url, headers, body }) {
  const parts = [`curl -s ${shq(url)}`];
  if (method && method !== 'GET') parts.push(`-X ${method}`);
  for (const [k, v] of Object.entries(headers)) parts.push(`-H ${shq(`${k}: ${v}`)}`);
  if (body) parts.push(`--data-raw ${shq(body)}`);
  return `${parts.join(' \\\n  ')}\n`;
}

// ---------- Replay outside browser ----------
async function replay(req, label) {
  await sleep(REPLAY_DELAY_MS);
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    const text = (await res.text()).slice(0, MAX_BODY);
    const json = tryJson(text);
    const q = QUERY.split(/\s+/)[0].toLowerCase();
    const products = json ? extractProducts(json).filter((p) => p.name.toLowerCase().includes(q)) : [];
    const ok = res.ok && products.length > 0;
    return { ok, status: res.status, products, text, label };
  } catch (e) {
    return { ok: false, status: 0, products: [], text: String(e), label };
  }
}

function cleanHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    if (k.startsWith(':') || DROP_HEADERS.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

async function minimize(req, log) {
  const base = { ...req, headers: cleanHeaders(req.headers) };
  let r = await replay(base, 'all headers, no cookies');
  log(`  replay (all headers, no cookies): HTTP ${r.status}, products=${r.products.length}`);
  let needsCookies = false;
  if (!r.ok && req.headers.cookie) {
    r = await replay({ ...base, headers: { ...base.headers, cookie: req.headers.cookie } }, 'with cookies');
    log(`  replay (with browser cookies): HTTP ${r.status}, products=${r.products.length}`);
    if (r.ok) needsCookies = true;
  }
  if (!r.ok) return { works: false, needsCookies, minimal: null, required: [], lastStatus: r.status, sample: r.text.slice(0, 300) };
  if (needsCookies) return { works: true, needsCookies, minimal: { ...base, headers: { ...base.headers, cookie: req.headers.cookie } }, required: ['cookie'] };

  // Greedy header removal.
  let headers = { ...base.headers };
  for (const key of Object.keys(base.headers)) {
    const trial = { ...headers };
    delete trial[key];
    const t = await replay({ ...base, headers: trial }, `without ${key}`);
    if (t.ok) headers = trial;
    else log(`  header required: ${key} (without it: HTTP ${t.status})`);
  }
  return { works: true, needsCookies, minimal: { ...base, headers }, required: Object.keys(headers) };
}

// ---------- Location detection & substitution ----------
function findLocationFields(req) {
  const fields = [];
  const check = (where, key, value) => {
    const v = String(value ?? '');
    // Match by key name first (catches empty values like Apollo's "pincode":"").
    if (/^(pin|pin_?code|pincode|zip|zip_?code|postal_?code|postcode)$/i.test(key.split('.').at(-1))) fields.push({ where, key, kind: 'pin', value: v });
    else if (/^(city|city_?name|cityName|x-city)$/i.test(key.split('.').at(-1))) fields.push({ where, key, kind: 'city', value: v || 'Gurgaon' });
    else if (/^\d{6}$/.test(v)) fields.push({ where, key, kind: 'pin', value: v });
    else if (CITY_NAMES.includes(v.toLowerCase())) fields.push({ where, key, kind: 'city', value: v });
    else if (/^(lat|latitude)$/i.test(key)) fields.push({ where, key, kind: 'lat', value: v });
    else if (/^(lng|lon|long|longitude)$/i.test(key)) fields.push({ where, key, kind: 'lng', value: v });
    else if (/(pin|zip|postal)/i.test(key) && /^\d{6}$/.test(v)) fields.push({ where, key, kind: 'pin', value: v });
  };
  const u = new URL(req.url);
  for (const [k, v] of u.searchParams) check('query', k, v);
  for (const [k, v] of Object.entries(req.headers)) check('header', k, v);
  const body = tryJson(req.body || '');
  if (body && typeof body === 'object') {
    const walk = (o, p) => {
      for (const [k, v] of Object.entries(o)) {
        if (v && typeof v === 'object') walk(v, `${p}${k}.`);
        else check('body', p + k, v);
      }
    };
    walk(body, '');
  }
  return fields;
}

function withLocation(req, fields, loc) {
  const u = new URL(req.url);
  const headers = { ...req.headers };
  let body = tryJson(req.body || '');
  const pick = (kind, original) => {
    if (kind === 'pin') return loc.pin;
    if (kind === 'lat') return loc.lat;
    if (kind === 'lng') return loc.lng;
    // keep the site's casing style
    return original === original.toLowerCase() ? loc.city.toLowerCase() : loc.city;
  };
  for (const f of fields) {
    const nv = pick(f.kind, f.value);
    if (f.where === 'query') u.searchParams.set(f.key, nv);
    else if (f.where === 'header') headers[f.key] = nv;
    else if (f.where === 'body' && body) {
      const parts = f.key.split('.');
      let o = body;
      for (const p of parts.slice(0, -1)) o = o[p];
      const last = parts.at(-1);
      o[last] = typeof o[last] === 'number' ? Number(nv) : nv;
    }
  }
  return { ...req, url: u.toString(), headers, body: body ? JSON.stringify(body) : req.body };
}

function comparePrices(a, b) {
  const firstPrice = (p) => p.prices[Object.keys(p.prices).find((k) => !/mrp/i.test(k)) ?? Object.keys(p.prices)[0]];
  const mapB = new Map(b.map((p) => [p.name, p]));
  const rows = [];
  for (const p of a.slice(0, 15)) {
    const q = mapB.get(p.name);
    if (q) rows.push({ name: p.name, a: firstPrice(p), b: firstPrice(q) });
  }
  return { rows, differing: rows.filter((r) => r.a !== r.b).length };
}

// ---------- Auth header classification ----------
// Explains required auth-like headers: static app key embedded in the site, or an anonymous public token
// (with expiry) that must be re-fetched. Also finds which captured request issued the token.
function classifyAuth(required, headers, records) {
  const notes = [];
  for (const key of required) {
    if (!/auth|token|key|session|signature/i.test(key)) continue;
    const raw = String(headers[key]);
    const value = raw.replace(/^(Bearer|Basic|Token)\s+/i, '');
    let kind = 'unknown token: check whether it changes between visits';
    const parts = value.split('.');
    if (parts.length === 3) {
      try {
        const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        const hrs = claims.exp ? ((claims.exp * 1000 - Date.now()) / 3.6e6).toFixed(1) : '?';
        kind = `JWT type=${claims.type ?? '-'} scope=${JSON.stringify(claims.scope ?? '-')} expires in ${hrs}h${/public|anon|guest/i.test(JSON.stringify(claims)) ? ' (anonymous public token)' : ' (may be user/session token)'}`;
      } catch { /* not a JWT */ }
    } else {
      try {
        const dec = Buffer.from(value, 'base64').toString();
        if (/^[\w-]{8,}:[\w-]+$/.test(dec)) kind = 'base64 "appId:secret": static application key shipped in the site JS';
      } catch { /* not base64 */ }
    }
    const issuer = records.find((r) => r.resBody.includes(value.slice(0, 40)) && !r.url.includes('search'));
    notes.push(`${key}: ${kind}${issuer ? `; issued by ${issuer.method} ${issuer.url.split('?')[0]}` : ''}`);
  }
  return notes;
}

// ---------- Browser capture ----------
async function capture(browser, site, log) {
  const context = await browser.newContext({
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();
  const records = [];
  page.on('response', async (res) => {
    try {
      const req = res.request();
      const type = req.resourceType();
      if (type !== 'xhr' && type !== 'fetch') return;
      const ct = res.headers()['content-type'] || '';
      if (!/json|graphql|javascript|text\/plain/i.test(ct)) return;
      const body = (await res.text()).slice(0, MAX_BODY);
      records.push({ url: req.url(), method: req.method(), headers: await req.allHeaders(), body: req.postData() || '', status: res.status(), resBody: body });
    } catch { /* response body unavailable (redirects etc.) */ }
  });

  const status = { blocked: false, note: '' };
  const visit = async (url) => {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch((e) => ({ error: e }));
    if (resp?.error) { status.note = `navigation error: ${resp.error.message.split('\n')[0]}`; return false; }
    const title = (await page.title().catch(() => '')) || '';
    const code = resp?.status?.() ?? 0;
    if (code === 403 || code === 429 || /access denied|just a moment|attention required|captcha/i.test(title)) {
      status.blocked = true;
      status.note = `blocked (HTTP ${code}, title "${title}"). Not bypassing.`;
      return false;
    }
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await sleep(3000);
    return true;
  };

  const hasCandidate = () => records.some((r) => scoreResponse({ url: r.url, body: r.resBody }).score > 0);

  if (site.searchUrl) {
    log(`  opening search page: ${site.searchUrl(QUERY)}`);
    await visit(site.searchUrl(QUERY));
  }
  if (!status.blocked && !hasCandidate()) {
    log(`  opening homepage and typing "${QUERY}" into the search box`);
    if (await visit(site.home)) {
      const selectors = [
        'input[type="search"]',
        'input[placeholder*="search" i]',
        'input[placeholder*="medicine" i]',
        'input[aria-label*="search" i]',
        'input[name*="search" i]',
        'input[name="q"]',
        '[role="searchbox"]',
        '[role="combobox"] input',
        'input:focus',
      ];
      const findInput = async () => {
        for (const sel of selectors) {
          const el = page.locator(sel).filter({ visible: true }).first();
          if (await el.count().catch(() => 0)) return el;
        }
        return null;
      };
      let el = await findInput();
      // Many sites render a fake search bar (div/button) that opens the real input when clicked.
      const triggers = ['[placeholder*="search" i]', 'text=/search (for )?(medicines|products)/i', '[class*="search" i]', '[id*="search" i]', '[aria-label*="search" i]'];
      for (const t of triggers) {
        if (el) break;
        await page.locator(t).filter({ visible: true }).first().click({ timeout: 2500 }).catch(() => {});
        await sleep(1200);
        el = await findInput();
      }
      if (el) {
        await el.click({ timeout: 3000 }).catch(() => {});
        await el.pressSequentially(QUERY, { delay: 120 }).catch(() => {});
        await sleep(3000); // autocomplete/suggest calls fire here
        await el.press('Enter').catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await sleep(3000);
      } else status.note ||= 'could not find a search box';
    }
  }

  await context.close();
  return { records, status };
}

// ---------- Main ----------
async function run() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED });
  const report = [`# Endpoint discovery report`, ``, `Query: \`${QUERY}\` · Run: ${new Date().toISOString()}`, ``];
  const summary = [];

  const sites = ONLY.length ? SITES.filter((s) => ONLY.includes(s.id)) : SITES;
  for (const site of sites) {
    const dir = path.join(OUT, site.id);
    await fs.mkdir(dir, { recursive: true });
    const lines = [];
    const log = (m) => { console.log(m); lines.push(m); };
    log(`\n=== ${site.id}`);

    let result = { status: 'no-candidate' };
    try {
      const { records, status } = await capture(browser, site, log);
      log(`  captured ${records.length} JSON fetch/XHR responses`);
      if (status.blocked) { result = { status: 'blocked', note: status.note }; log(`  ${status.note}`); throw 'done'; }

      const ranked = records
        .map((r) => ({ ...r, ...scoreResponse({ url: r.url, body: r.resBody }) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (!ranked.length) { result = { status: 'no-candidate', note: status.note || 'no JSON response with product prices seen (data may be server-rendered: use product pages)' }; log(`  ${result.note}`); throw 'done'; }

      for (const [i, c] of ranked.entries()) {
        await fs.writeFile(path.join(dir, `candidate-${i + 1}.curl.sh`), toCurl(c));
        await fs.writeFile(path.join(dir, `candidate-${i + 1}.json`), c.resBody);
        log(`  candidate ${i + 1}: score=${c.score} ${c.method} ${c.url.slice(0, 160)}`);
        log(`    sample: ${c.products.slice(0, 3).map((p) => `${p.name} ${JSON.stringify(p.prices)}`).join(' | ').slice(0, 300)}`);
      }

      const best = ranked[0];
      const req = { url: best.url, method: best.method, headers: best.headers, body: best.body };
      log(`  minimizing request outside the browser…`);
      const min = await minimize(req, log);
      if (!min.works) {
        result = { status: 'browser-only', url: best.url, note: `replay failed (HTTP ${min.lastStatus}). Likely needs a signed token or bot-protection cookie, so not usable (see DATA_SOURCES.md rules). ${min.sample ?? ''}`.slice(0, 400) };
        log(`  ${result.note}`);
        throw 'done';
      }
      await fs.writeFile(path.join(dir, 'minimal.curl.sh'), toCurl(min.minimal));
      log(`  minimal request works. Required headers: ${min.required.join(', ') || '(none)'}${min.needsCookies ? '  NEEDS SESSION COOKIES (not usable: no session reuse)' : ''}`);
      const authNotes = classifyAuth(min.required, min.minimal.headers, records);
      for (const n of authNotes) log(`  auth → ${n}`);

      // Location sensitivity
      const fields = findLocationFields(min.minimal);
      let loc = 'no location field found in request';
      if (fields.length) {
        log(`  location fields: ${fields.map((f) => `${f.where}:${f.key}=${f.value} (${f.kind})`).join(', ')}`);
        const res = [];
        for (const L of LOCATIONS) {
          const r = await replay(withLocation(min.minimal, fields, L), L.label);
          await fs.writeFile(path.join(dir, `location-${L.label}.json`), r.text);
          log(`  ${L.label} (${L.pin}): HTTP ${r.status}, products=${r.products.length}`);
          res.push(r);
        }
        if (res.every((r) => r.ok)) {
          const cmp = comparePrices(res[0].products, res[1].products);
          for (const row of cmp.rows.slice(0, 6)) log(`    ${row.name.slice(0, 50).padEnd(50)} ${LOCATIONS[0].label} ₹${row.a}  ${LOCATIONS[1].label} ₹${row.b}${row.a !== row.b ? '  ← differs' : ''}`);
          loc = cmp.rows.length ? `${cmp.differing}/${cmp.rows.length} compared products differ in price between ${LOCATIONS.map((l) => l.label).join(' and ')}` : 'could not align products across locations';
        } else loc = 'location replay failed';
      }
      log(`  location: ${loc}`);
      result = { status: min.needsCookies ? 'needs-cookies' : 'usable', url: min.minimal.url, required: min.required, auth: authNotes, location: loc };
    } catch (e) {
      if (e !== 'done') { result = { status: 'error', note: String(e?.message ?? e).slice(0, 300) }; log(`  error: ${result.note}`); }
    }

    await fs.writeFile(path.join(dir, 'log.txt'), lines.join('\n'));
    summary.push({ site: site.id, ...result });
    report.push(`## ${site.id}`, '', '```text', ...lines.slice(1), '```', '');
  }

  await browser.close();
  report.splice(4, 0, '| Site | Status | Required headers | Auth | Location sensitivity |', '|---|---|---|---|---|',
    ...summary.map((s) => `| ${s.site} | ${s.status} | ${(s.required || []).join(', ') || '-'} | ${(s.auth || []).join('<br>') || '-'} | ${(s.location || s.note || '-').slice(0, 160)} |`), '');
  await fs.writeFile(path.join(OUT, 'REPORT.md'), report.join('\n'));
  console.log(`\nReport: ${path.join(OUT, 'REPORT.md')}`);
}

export { extractProducts, toCurl, replay, minimize, findLocationFields, withLocation, comparePrices, classifyAuth, cleanHeaders };

// Run only when executed directly (not when imported by test-curl.mjs).
if (import.meta.url === `file://${process.argv[1]}`) run().catch((e) => { console.error(e); process.exit(1); });
