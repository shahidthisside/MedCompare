// Save raw live responses as test fixtures: node --experimental-strip-types scripts/capture.ts truemeds,netmeds "dolo 650"
import { writeFileSync } from 'node:fs';
import { ADAPTERS } from '../src/lib/sources/adapters.ts';
import type { SourceId } from '../src/lib/types.ts';

const [ids = '', q = 'dolo 650'] = process.argv.slice(2);
for (const id of ids.split(',') as SourceId[]) {
  const raw = await ADAPTERS[id].fetch(q, { pin: '110001', city: 'New Delhi' }, AbortSignal.timeout(15_000));
  writeFileSync(new URL(`../src/lib/sources/__fixtures__/${id}.json`, import.meta.url), JSON.stringify(raw));
  console.log(id, 'saved', ADAPTERS[id].parse(raw, q).length, 'listings');
}
