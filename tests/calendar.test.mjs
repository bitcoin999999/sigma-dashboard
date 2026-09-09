import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Compile the actual modules; no duplicated status/date implementation in tests.
const folder = mkdtempSync(join(tmpdir(), 'sigma-calendar-tests-'));
writeFileSync(join(folder, 'package.json'), '{"type":"commonjs"}');
for (const name of ['calendar-state', 'econ-calendar']) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  writeFileSync(join(folder, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const require = createRequire(import.meta.url);
const { easternInstant, easternDate, releaseState, keySchedule, retainCalendar, eventKind } = require(join(folder, 'calendar-state.js'));
const { loadWeekCalendar } = require(join(folder, 'econ-calendar.js'));
after(() => rmSync(folder, { recursive: true, force: true }));
const event = (overrides = {}) => ({ date: '2026-09-11', timeEt: '08:30', timeKst: '21:30', kstNextDay: false, name: 'CPI', tier: 1, kind: 'print', actual: null, forecast: '0.2%', previous: '0.1%', ...overrides });
const before = Date.parse('2026-09-11T12:29:00Z');
const afterRelease = Date.parse('2026-09-11T12:31:00Z');
const day = (overrides = {}) => ({ date: '2026-09-11', events: [], earnings: [], macroStatus: 'ok', earningsStatus: 'ok', macroCheckedAt: '2026-09-11T12:00:00Z', earningsCheckedAt: '2026-09-11T12:00:00Z', ...overrides });
const week = (days) => ({ weekStart: '2026-09-07', weekEnd: '2026-09-11', todayEt: '2026-09-11', checkedAt: '2026-09-11T12:00:00Z', days });

test('ET release instant respects summer/winter and Korean next day', () => {
  assert.equal(easternInstant('2026-09-11', '08:30').toISOString(), '2026-09-11T12:30:00.000Z');
  assert.equal(easternInstant('2026-01-09', '08:30').toISOString(), '2026-01-09T13:30:00.000Z');
  assert.equal(easternInstant('2026-09-11', '14:00').toISOString(), '2026-09-11T18:00:00.000Z');
  assert.equal(easternDate(new Date('2026-09-12T01:00:00Z')), '2026-09-11');
});
test('null after the scheduled time remains unconfirmed; a zero string is received', () => {
  assert.equal(releaseState(event(), before), 'scheduled');
  assert.equal(releaseState(event(), afterRelease), 'unconfirmed');
  assert.equal(releaseState(event({actual: '0.0%'}), afterRelease), 'received');
});
test('speeches and all-day events do not claim a numerical release was received', () => {
  assert.equal(eventKind('FOMC Statement'), 'event');
  assert.equal(eventKind('Fed Chair Example Speaks'), 'event');
  assert.equal(eventKind('Fed Interest Rate Decision'), 'print');
  assert.equal(releaseState(event({kind:'event'}), afterRelease), 'elapsed');
  assert.equal(releaseState(event({kind:'event', timeEt:''}), afterRelease), 'all-day');
});
test('next key groups simultaneous CPI series and keeps unconfirmed keys visible', () => {
  const calendar = week([day({ events: [event(), event({name:'Core CPI'}), event({name:'GDP', timeEt:'08:00'}), event({name:'Claims', tier:2, timeEt:'08:31'})] })]);
  const summary = keySchedule(calendar, before);
  assert.deepEqual(summary.next.map(e => e.name), ['CPI','Core CPI']);
  assert.deepEqual(summary.unconfirmed.map(e => e.name), ['GDP']);
  assert.equal(keySchedule(week([day({macroStatus:'error'})]), before).incomplete, true);
});
test('failed feeds retain data and original success time independently; new weeks never inherit', () => {
  const old = week([day({events:[event()],earnings:[{symbol:'NVDA'}]})]);
  const next = week([day({events:[],macroStatus:'error',macroCheckedAt:null,earnings:[],earningsCheckedAt:'2026-09-11T13:00:00Z'})]);
  const merged = retainCalendar(next, old).days[0];
  assert.equal(merged.events.length, 1);
  assert.equal(merged.macroStatus, 'error');
  assert.equal(merged.macroCheckedAt, old.days[0].macroCheckedAt);
  assert.deepEqual(merged.earnings, []);
  assert.deepEqual(retainCalendar({...next,weekStart:'2026-09-14'}, old).days[0].events, []);
});
test('vendor failures differ from valid empty arrays; Core/headline preserved and cap retained', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(input);
    if (url.pathname.endsWith('/earnings')) return {ok:true,json:async()=>({data:{rows:[{symbol:'SMTC',time:'time-not-supplied'}]}})};
    if (url.searchParams.get('date') === '2026-09-08') return {ok:true,json:async()=>({data:null})};
    if (url.searchParams.get('date') === '2026-09-09') return {ok:true,json:async()=>({data:{rows:[]}})};
    return {ok:true,json:async()=>({data:{rows:['PCE Price Index','PCE price index','Core PCE Price Index','CPI','Core CPI','PPI','Initial Jobless Claims'].map(eventName=>({country:'United States',eventName,gmt:'08:30',actual:'—',consensus:'0.2%'}))}})};
  };
  try {
    const calendar = await loadWeekCalendar('2026-09-04',['SMTC']);
    assert.equal(calendar.days[0].macroStatus,'error');
    assert.equal(calendar.days[0].macroCheckedAt,null);
    assert.equal(calendar.days[1].macroStatus,'ok');
    assert.equal(calendar.days[1].events.length,0);
    const names=calendar.days[2].events.map(e=>e.name);
    assert.equal(names.length,5);
    assert.ok(names.includes('PCE Price Index') && names.includes('Core PCE Price Index'));
    assert.equal(calendar.days[2].events[0].actual,null);
    assert.equal(calendar.days[2].earnings[0].session,'UNKNOWN');
    // Same-size universes must not reuse each other's earnings cache.
    assert.equal((await loadWeekCalendar('2026-09-04',['OTHER'])).days[2].earnings.length,0);
  } finally {globalThis.fetch=originalFetch;}
});


test('explicit Nasdaq no-record response is an empty schedule, not a feed failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({
    data: null, status: { rCode: 200, bCodeMessage: [{code: 1002, errorMessage: 'Economic Events Calendar: No record found.'}] },
  }) });
  try {
    const calendar = await loadWeekCalendar('2026-09-04', ['EMPTY_RESPONSE_TEST']);
    assert.equal(calendar.days.length, 5);
    for (const day of calendar.days) {
      assert.equal(day.macroStatus, 'ok');
      assert.equal(day.earningsStatus, 'ok');
      assert.deepEqual(day.events, []);
      assert.deepEqual(day.earnings, []);
      assert.ok(day.macroCheckedAt);
    }
  } finally { globalThis.fetch = originalFetch; }
});
