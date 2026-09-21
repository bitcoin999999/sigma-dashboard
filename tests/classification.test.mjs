import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function compile(path) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  return mod.exports;
}
const { matchesClassification, classificationOptions, EMPTY_CLASSIFICATION_FILTERS: empty } = compile('../lib/classification.ts');
const { buildStockData, matchesQuery, groupBySector } = compile('../lib/sigma.ts');
const { assertSnapshotFile } = compile('../lib/snapshot/types.ts');
const { tickerDirectory, matchingTickers } = compile('../lib/ticker-search.ts');
const quote = (symbol, classification) => ({ symbol, name: symbol, price: 110, previousClose: 109,
  anchor: 100, sigmaPercent: 10, history: [], ...classification });
const stocks = [
  quote('CEG', { sector: 'Utilities', themes: ['Nuclear', 'AI Power Demand'], region: 'US', assetClass: 'equity' }),
  quote('ETN', { sector: 'Industrials', themes: ['Power Infrastructure', 'AI Infrastructure'], region: 'Global', assetClass: 'equity' }),
  quote('CIBR', { sector: 'Technology', themes: ['Cybersecurity'], region: 'Global', assetClass: 'etf' }),
  quote('CRWD', { sector: 'Technology', themes: ['Cybersecurity', 'Cloud'], region: 'US', assetClass: 'equity' }),
];

test('original semiconductor, optical and neocloud groups remain separately browsable', () => {
  const groups = [quote('DELL', { sector: 'Semiconductors' }), quote('AAOI', { sector: 'Optical' }),
    quote('IREN', { sector: 'Neocloud' })].map(buildStockData);
  assert.deepEqual(new Set(groupBySector(groups).map(g => g.sector)), new Set(['Semiconductors', 'Optical', 'Neocloud']));
  assert.deepEqual(groups.filter(s => matchesClassification(s, { ...empty, sector: 'Optical' })).map(s => s.symbol), ['AAOI']);
});

test('sector, theme, region and asset type are independent AND filters', () => {
  const filters = { sector: 'Technology', theme: 'Cybersecurity', region: 'US', assetClass: 'equity' };
  assert.deepEqual(stocks.filter(s => matchesClassification(s, filters)).map(s => s.symbol), ['CRWD']);
  assert.deepEqual(stocks.filter(s => matchesClassification(s, { ...empty, theme: 'Cybersecurity' })).map(s => s.symbol), ['CIBR', 'CRWD']);
  assert.equal(matchesClassification(stocks[0], { ...empty, sector: 'Industrials' }), false);
  assert.equal(matchesClassification(stocks[1], { ...empty, sector: 'Utilities' }), false);
});

test('themes remain searchable while grouping uses the actual sector', () => {
  const derived = stocks.map(buildStockData);
  assert.equal(matchesQuery(derived[3], 'cybersecurity'), true);
  assert.equal(matchesQuery(derived[1], 'power infrastructure'), true);
  assert.deepEqual(groupBySector(derived).find(g => g.sector === 'Technology').stocks.map(s => s.symbol), ['CIBR', 'CRWD']);
  assert.equal(groupBySector(derived).some(g => g.sector === 'Cybersecurity'), false);
});

test('classification does not change prices, band arithmetic or ticker search', () => {
  for (const raw of stocks) {
    const derived = buildStockData(raw);
    assert.equal(derived.price, 110);
    assert.equal(derived.zScore, 1);
    assert.equal(derived.sigma1Upper, 110);
    assert.equal(derived.sigma1Lower, 90);
    assert.deepEqual(matchingTickers(tickerDirectory(stocks), raw.symbol).map(s => s.symbol), [raw.symbol]);
  }
});

test('filter options deduplicate multi-theme stocks and distinguish missing legacy metadata', () => {
  const old = quote('OLD', { sector: 'Software' });
  assert.equal(matchesClassification(old, empty), true);
  assert.equal(matchesClassification(old, { ...empty, assetClass: 'equity' }), false);
  assert.equal(matchesClassification(old, { ...empty, assetClass: 'unknown' }), true);
  const options = classificationOptions([...stocks, old]);
  assert.equal(options.theme.filter(t => t === 'Cybersecurity').length, 1);
  assert.ok(options.region.includes('Unknown'));
});

test('classified snapshots reject missing, invalid and duplicate symbols without serving fake zero bands', () => {
  const input = { schemaVersion: 1, classificationVersion: 1, generatedAt: '2026-09-21T10:00:00+09:00',
    band: { anchorDate: '2026-09-18', sessionDate: '2026-09-18', elapsedDays: 0 }, quotes: stocks, sectorQuotes: [] };
  assert.doesNotThrow(() => assertSnapshotFile(input, 'test'));
  for (const mutation of [s => { delete s.quotes[0].sigmaPercent; }, s => { s.quotes[0].price = 0; },
    s => { s.quotes[0].themes = 'Nuclear'; }, s => { s.quotes[0].region = 'invented'; },
    s => { s.sectorQuotes = [s.quotes[0]]; }, s => { s.classificationVersion = 2; }]) {
    const bad = structuredClone(input); mutation(bad);
    assert.throws(() => assertSnapshotFile(bad, 'test'));
  }
  const legacy = { ...input, classificationVersion: undefined, quotes: [quote('OLD', { sector: 'Software' })] };
  assert.doesNotThrow(() => assertSnapshotFile(legacy, 'legacy'));
});
