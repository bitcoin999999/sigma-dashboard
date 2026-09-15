import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const folder = mkdtempSync(join(tmpdir(), 'sigma-http-'));
mkdirSync(join(folder, 'sources'));
writeFileSync(join(folder, 'package.json'), '{"type":"commonjs"}');
for (const name of ['types', 'sources/http', 'sources/blob']) {
  writeFileSync(join(folder, `${name}.js`), ts.transpileModule(
    readFileSync(new URL(`../lib/snapshot/${name}.ts`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
}
const require = createRequire(import.meta.url);
const { httpSource } = require(join(folder, 'sources/http.js'));
const { blobSource } = require(join(folder, 'sources/blob.js'));
after(() => rmSync(folder, { recursive: true, force: true }));
const original = {
  schemaVersion: 1, generatedAt: '2026-09-15T07:06:35+09:00',
  band: { anchorDate: '2026-09-11', sessionDate: '2026-09-14', elapsedDays: 1 },
  quotes: [{ symbol: 'SPY', price: 760.88 }], sectorQuotes: [],
};

test('static source follows new publications without changing prices or dates', async () => {
  const originalFetch = globalThis.fetch;
  const next = { ...original, generatedAt: '2026-09-16T07:06:00+09:00',
    band: { ...original.band, sessionDate: '2026-09-15', elapsedDays: 2 } };
  const payloads = [original, next];
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://example.test/snapshot/latest.json');
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(JSON.stringify(payloads.shift()));
    };
    const source = httpSource('https://example.test/snapshot/latest.json');
    assert.deepEqual(await source.load(), original);
    assert.deepEqual(await source.load(), next);
  } finally { globalThis.fetch = originalFetch; }
});

test('HTTP, network, JSON and schema errors never serve a bundled old snapshot', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [body, status] of [
      ['Your store is blocked', 403], ['not found', 404], ['failure', 500],
      ['<html>error</html>', 200],
      [JSON.stringify({ ...original, quotes: [] }), 200],
      [JSON.stringify({ ...original, schemaVersion: 2 }), 200],
    ]) {
      globalThis.fetch = async () => new Response(body, { status });
      await assert.rejects(httpSource('https://example.test/snapshot').load());
    }
    globalThis.fetch = async () => { throw new Error('network failure'); };
    await assert.rejects(httpSource('https://example.test/snapshot').load(), /network failure/);
  } finally { globalThis.fetch = originalFetch; }
});

test('calendar polls read only the small context and follow the next band publication', async () => {
  const originalFetch = globalThis.fetch;
  const context = { schemaVersion: 1, generatedAt: original.generatedAt,
    anchorDate: original.band.anchorDate, symbols: ['SPY', 'QQQ'] };
  const next = { ...context, generatedAt: '2026-09-19T07:06:00+09:00', anchorDate: '2026-09-18' };
  const payloads = [context, next];
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://example.test/snapshot/calendar-context.json');
      assert.equal(options.cache, 'no-store');
      return new Response(JSON.stringify(payloads.shift()));
    };
    const source = httpSource('https://example.test/snapshot/latest.json');
    assert.deepEqual(await source.loadCalendarContext(), context);
    assert.deepEqual(await source.loadCalendarContext(), next);
    assert.equal(blobSource('https://example.test/latest.json').loadCalendarContext, undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test('missing, blocked and malformed calendar context fails instead of serving an old band', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const source = httpSource('https://example.test/snapshot/latest.json');
    for (const [body, status] of [['missing', 404], ['blocked', 403], ['{}', 200],
      [JSON.stringify({ schemaVersion: 1, generatedAt: original.generatedAt,
        anchorDate: '2026-09-11', symbols: [] }), 200]]) {
      globalThis.fetch = async () => new Response(body, { status });
      await assert.rejects(source.loadCalendarContext());
    }
  } finally { globalThis.fetch = originalFetch; }
});
