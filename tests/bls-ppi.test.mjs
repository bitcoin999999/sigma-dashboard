import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const folder = mkdtempSync(join(tmpdir(), 'sigma-bls-ppi-tests-'));
writeFileSync(join(folder, 'package.json'), '{"type":"commonjs"}');
for (const name of ['calendar-state', 'bls-ppi']) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  writeFileSync(join(folder, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const require = createRequire(import.meta.url);
const { parseBlsPpiActuals, applyBlsPpiFallback } = require(join(folder, 'bls-ppi.js'));
after(() => rmSync(folder, { recursive: true, force: true }));

const payload = (latestPeriod = 'M08') => ({
  status: 'REQUEST_SUCCEEDED',
  Results: { series: [
    { seriesID: 'WPSFD4', data: [
      { year: '2026', period: latestPeriod, latest: 'true', value: latestPeriod === 'M08' ? '157.411' : '156.784' },
      { year: '2026', period: 'M07', value: '156.784' },
    ] },
    { seriesID: 'WPSFD49104', data: [
      { year: '2026', period: latestPeriod, latest: 'true', value: latestPeriod === 'M08' ? '154.842' : '154.592' },
      { year: '2026', period: 'M07', value: '154.592' },
    ] },
  ] },
});

test('BLS indexes produce the official one-decimal PPI changes', () => {
  assert.deepEqual(parseBlsPpiActuals(payload(), '2026-09-10'), {
    PPI: '0.4%', 'Core PPI': '0.2%',
  });
});

test('stale BLS latest month is never promoted to today’s release', () => {
  assert.deepEqual(parseBlsPpiActuals(payload('M07'), '2026-09-10'), {});
});

test('fallback fills only blank due PPI rows and never overwrites Nasdaq actuals', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => payload() });
  const base = { date: '2026-09-10', timeEt: '08:30' };
  try {
    const events = await applyBlsPpiFallback([
      { ...base, name: 'PPI', actual: null },
      { ...base, name: 'Core PPI', actual: '0.1%', actualSource: 'nasdaq' },
      { ...base, name: 'CPI', actual: null },
    ], new Date('2026-09-10T12:31:00Z'));
    assert.deepEqual(events, [
      { ...base, name: 'PPI', actual: '0.4%', actualSource: 'bls' },
      { ...base, name: 'Core PPI', actual: '0.1%', actualSource: 'nasdaq' },
      { ...base, name: 'CPI', actual: null },
    ]);
  } finally { globalThis.fetch = originalFetch; }
});
