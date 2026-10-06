#!/usr/bin/env node
// Test a request you copied from Chrome DevTools (Network tab → right-click request → Copy → Copy as cURL (bash)).
//
// What it does:
//   1. Parses the cURL (URL, method, headers, cookies, body).
//   2. Replays it and finds the minimal set of headers that still works (e.g. x-city on 1mg).
//   3. Tells you whether it needs browser cookies, and what kind of auth token it uses (static key / public JWT + expiry).
//   4. Finds location fields (PIN, city, lat/lng) and replays with two locations to show whether prices differ.
//
// Usage:
//   pbpaste | node test-curl.mjs --name pharmeasy                       # macOS clipboard
//   node test-curl.mjs --name pharmeasy --file pharmeasy.curl.txt
//   node test-curl.mjs --name x --file req.txt --query "dolo" --locations "Gurgaon:122001,Mumbai:400001,Bengaluru:560001"
//
// Output: output/manual/<name>/{original.curl.sh, minimal.curl.sh, response.json, location-*.json, REPORT.md}

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  setQuery, replay, minimize, findLocationFields, withLocation, comparePrices, classifyAuth, toCurl, extractProducts,
} from './discover.mjs';
import { LOCATIONS as DEFAULT_LOCATIONS } from './sites.mjs';

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const NAME = argVal('--name', 'manual').replace(/[^\w-]/g, '_');
const FILE = argVal('--file', '');

// Known city coordinates for --locations (only PIN given → city/lat/lng looked up here when possible).
const KNOWN = {
  122001: { city: 'Gurgaon', lat: '28.4595', lng: '77.0266' },
  400001: { city: 'Mumbai', lat: '18.9388', lng: '72.8354' },
  110001: { city: 'New Delhi', lat: '28.6328', lng: '77.2197' },
  560001: { city: 'Bengaluru', lat: '12.9716', lng: '77.5946' },
  600001: { city: 'Chennai', lat: '13.0878', lng: '80.2785' },
  700001: { city: 'Kolkata', lat: '22.5726', lng: '88.3639' },
  500001: { city: 'Hyderabad', lat: '17.3850', lng: '78.4867' },
  411001: { city: 'Pune', lat: '18.5204', lng: '73.8567' },
};
const LOCATIONS = argVal('--locations', '')
  ? argVal('--locations').split(',').map((s) => {
      const [label, pin] = s.split(':');
      return { label, pin, city: KNOWN[pin]?.city ?? label, lat: KNOWN[pin]?.lat ?? '', lng: KNOWN[pin]?.lng ?? '' };
    })
  : DEFAULT_LOCATIONS;

// ---------- cURL parser (handles Chrome's bash format: '…', $'…', "…", line continuations) ----------
function tokenize(src) {
  const s = src.replace(/\\\r?\n/g, ' ');
  const out = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    let tok = '';
    while (i < s.length && !/\s/.test(s[i])) {
      if (s[i] === "'") { const j = s.indexOf("'", i + 1); tok += s.slice(i + 1, j); i = j + 1; }
      else if (s[i] === '$' && s[i + 1] === "'") {
        let j = i + 2; let buf = '';
        while (j < s.length && s[j] !== "'") {
          if (s[j] === '\\') { const n = s[j + 1]; buf += { n: '\n', t: '\t', r: '\r', "'": "'", '\\': '\\', '"': '"' }[n] ?? n; j += 2; }
          else buf += s[j++];
        }
        tok += buf; i = j + 1;
      } else if (s[i] === '"') {
        let j = i + 1; let buf = '';
        while (j < s.length && s[j] !== '"') { if (s[j] === '\\') { buf += s[j + 1]; j += 2; } else buf += s[j++]; }
        tok += buf; i = j + 1;
      } else if (s[i] === '\\') { tok += s[i + 1] ?? ''; i += 2; }
      else tok += s[i++];
    }
    out.push(tok);
  }
  return out;
}

function parseCurl(src) {
  const t = tokenize(src.trim());
  if (t[0] !== 'curl') throw new Error('Input does not start with "curl". Use DevTools → Copy → Copy as cURL (bash).');
  const req = { url: '', method: '', headers: {}, body: '' };
  for (let i = 1; i < t.length; i++) {
    const a = t[i];
    const next = () => t[++i];
    if (a === '-X' || a === '--request') req.method = next();
    else if (a === '-H' || a === '--header') {
      const h = next(); const c = h.indexOf(':');
      if (c > 0) req.headers[h.slice(0, c).trim().toLowerCase()] = h.slice(c + 1).trim();
    } else if (a === '-b' || a === '--cookie') req.headers.cookie = next();
    else if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode'].includes(a)) req.body = req.body ? `${req.body}&${next()}` : next();
    else if (a === '--url') req.url = next();
    else if (a.startsWith('-')) {
      if (['-A', '--user-agent'].includes(a)) req.headers['user-agent'] = next();
      else if (['-e', '--referer'].includes(a)) req.headers.referer = next();
      // flags without values (--compressed, -s, -L, -k, --insecure) are ignored
    } else if (!req.url) req.url = a;
  }
  if (!req.url) throw new Error('No URL found in cURL.');
  req.method ||= req.body ? 'POST' : 'GET';
  return req;
}

// Guess the search term from common parameter names, so results can be checked for relevance.
function guessQuery(req) {
  const keys = /^(q|query|search|searchquery|search_query|term|keyword|keywords|text|name|searchText|searchTerm)$/i;
  const u = new URL(req.url);
  for (const [k, v] of u.searchParams) if (keys.test(k) && v) return v;
  try {
    const b = JSON.parse(req.body);
    const walk = (o) => { for (const [k, v] of Object.entries(o ?? {})) { if (typeof v === 'string' && keys.test(k) && v) return v; if (v && typeof v === 'object') { const r = walk(v); if (r) return r; } } };
    return walk(b) ?? '';
  } catch { return ''; }
}

async function main() {
  const src = FILE ? await fs.readFile(FILE, 'utf8') : await new Promise((res) => { let d = ''; process.stdin.on('data', (c) => { d += c; }); process.stdin.on('end', () => res(d)); });
  if (!src.trim()) { console.error('Paste a cURL via stdin (pbpaste | node test-curl.mjs --name x) or use --file.'); process.exit(1); }

  const req = parseCurl(src);
  const query = argVal('--query', guessQuery(req));
  setQuery(query.split(/\s+/)[0] ?? '');
  const dir = path.resolve('output/manual', NAME);
  await fs.mkdir(dir, { recursive: true });
  const lines = [];
  const log = (m) => { console.log(m); lines.push(m); };

  log(`=== ${NAME}`);
  log(`  ${req.method} ${req.url.slice(0, 180)}`);
  log(`  headers: ${Object.keys(req.headers).join(', ')}`);
  log(`  relevance check uses query term: "${query || '(none: any product counts)'}"`);
  await fs.writeFile(path.join(dir, 'original.curl.sh'), toCurl(req));

  const min = await minimize(req, log);
  if (!min.works) {
    log(`  ✗ Replay failed outside the browser (last HTTP ${min.lastStatus}).`);
    log('    Likely causes: signed/rotating token, bot-protection cookie, or the response has no product prices.');
    log(`    Response start: ${(min.sample ?? '').replace(/\s+/g, ' ').slice(0, 200)}`);
  } else {
    await fs.writeFile(path.join(dir, 'minimal.curl.sh'), toCurl(min.minimal));
    log(`  ✓ Minimal request works. Required headers: ${min.required.join(', ') || '(none)'}`);
    if (min.needsCookies) log('  ⚠ Needs browser session cookies → not usable (no session reuse).');
    for (const n of classifyAuth(min.required, min.minimal.headers, [])) log(`  auth → ${n}`);

    const first = await replay(min.minimal, 'sample');
    await fs.writeFile(path.join(dir, 'response.json'), first.text);
    for (const p of first.products.slice(0, 5)) log(`    ${p.name.slice(0, 60).padEnd(60)} ${JSON.stringify(p.prices)}`);

    const fields = findLocationFields(min.minimal);
    if (!fields.length) {
      log('  location: no PIN/city/lat-lng field in the request. Prices are probably national, or location lives in a cookie.');
      log('            Tip: change location on the site, copy the same request again, and diff the two cURLs.');
    } else {
      log(`  location fields: ${fields.map((f) => `${f.where}:${f.key}=${f.value || '""'} (${f.kind})`).join(', ')}`);
      const results = [];
      for (const L of LOCATIONS) {
        const r = await replay(withLocation(min.minimal, fields, L), L.label);
        await fs.writeFile(path.join(dir, `location-${L.label}.json`), r.text);
        log(`  ${L.label} (${L.pin}): HTTP ${r.status}, products=${r.products.length}`);
        results.push(r);
      }
      for (let i = 1; i < results.length; i++) {
        if (!results[0].ok || !results[i].ok) continue;
        const cmp = comparePrices(results[0].products, results[i].products);
        for (const row of cmp.rows.slice(0, 6)) log(`    ${row.name.slice(0, 48).padEnd(48)} ${LOCATIONS[0].label} ₹${row.a}  ${LOCATIONS[i].label} ₹${row.b}${row.a !== row.b ? '  ← differs' : ''}`);
        log(`  → ${cmp.differing}/${cmp.rows.length} products differ between ${LOCATIONS[0].label} and ${LOCATIONS[i].label}`);
      }
    }
  }
  await fs.writeFile(path.join(dir, 'REPORT.md'), `# ${NAME}\n\n\`\`\`text\n${lines.join('\n')}\n\`\`\`\n`);
  console.log(`\nSaved: ${dir}`);
}

main().catch((e) => { console.error(`Error: ${e.message}`); process.exit(1); });
