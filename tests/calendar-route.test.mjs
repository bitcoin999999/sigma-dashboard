import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../app/api/calendar/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test('calendar route keeps week selection and anchor guards with zero full snapshot reads', async () => {
  const calls = [];
  let broken = false;
  const context = { anchorDate: '2026-09-11', symbols: ['SPY', 'COST'] };
  const dependencies = {
    'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } },
    '@/lib/snapshot': { loadCalendarContext: async () => {
      if (broken) throw new Error('source down');
      return context;
    } },
    '@/lib/econ-calendar': { loadWeekCalendar: async (...args) => {
      calls.push(args); return { weekStart: args[2] ? '2026-09-21' : '2026-09-14' };
    } },
  };
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(dependencies[name], name); return dependencies[name];
  }, compiledModule, compiledModule.exports);
  const request = query => compiledModule.exports.GET(new Request(`https://example.test/api/calendar?${query}`));
  assert.equal((await request('week=0&anchor=2026-09-11')).status, 200);
  assert.equal((await (await request('week=1&anchor=2026-09-11')).json()).weekStart, '2026-09-21');
  assert.deepEqual(calls, [['2026-09-11', ['SPY', 'COST'], 0], ['2026-09-11', ['SPY', 'COST'], 1]]);
  assert.equal((await request('week=2')).status, 400);
  assert.equal((await request('anchor=2026-09-04')).status, 409);
  assert.equal(calls.length, 2);
  broken = true;
  assert.equal((await request('week=0')).status, 503);
});
