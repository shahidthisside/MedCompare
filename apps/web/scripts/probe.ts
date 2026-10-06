// Live check of every pharmacy API (no Next needed): node --experimental-strip-types scripts/probe.ts "dolo 650" 122001 Gurgaon
import { ADAPTERS } from '../src/lib/sources/adapters.ts';

const [q = 'dolo 650', pin = '122001', city = 'Gurgaon'] = process.argv.slice(2);
for (const a of Object.values(ADAPTERS)) {
  const t = Date.now();
  try {
    const ls = a.parse(await a.fetch(q, { pin, city }, AbortSignal.timeout(10_000)), q);
    const top = ls.slice(0, 2).map((l) => `${l.name} ₹${l.pricePaise / 100}${l.units ? `/${l.units}${l.unitType}` : ''}`).join(' | ');
    console.log(`✓ ${a.id.padEnd(11)} ${String(Date.now() - t).padStart(5)}ms ${String(ls.length).padStart(3)} items  ${top}`);
  } catch (e) {
    console.log(`✗ ${a.id.padEnd(11)} ${String(Date.now() - t).padStart(5)}ms ${(e as Error).message}`);
  }
}
