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
for (const name of ['calendar-state', 'bls-ppi', 'econ-calendar']) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  writeFileSync(join(folder, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const require = createRequire(import.meta.url);
const { easternInstant, easternDate, calendarDate, calendarDisplayDays, calendarZoneLabel, eventDisplayTime, earningsDisplayDate, releaseState, keySchedule, retainCalendar, eventKind } = require(join(folder, 'calendar-state.js'));
const { loadWeekCalendar } = require(join(folder, 'econ-calendar.js'));
after(() => rmSync(folder, { recursive: true, force: true }));
const event = (overrides = {}) => ({ date: '2026-09-11', timeEt: '08:30', timeKst: '21:30', kstNextDay: false, name: 'CPI', tier: 1, kind: 'print', actual: null, forecast: '0.2%', previous: '0.1%', ...overrides });
const before = Date.parse('2026-09-11T12:29:00Z');
const afterRelease = Date.parse('2026-09-11T12:31:00Z');
const day = (overrides = {}) => ({ date: '2026-09-11', events: [], earnings: [], macroStatus: 'ok', earningsStatus: 'ok', macroCheckedAt: '2026-09-11T12:00:00Z', earningsCheckedAt: '2026-09-11T12:00:00Z', ...overrides });
const week = (days) => ({ weekStart: '2026-09-07', weekEnd: '2026-09-11', todayEt: '2026-09-11', checkedAt: '2026-09-11T12:00:00Z', days });

test('next week shifts both feeds seven days and keeps each week cached independently', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async input => {
    requests.push(new URL(input));
    return {ok:true,json:async()=>({data:{rows:[]}})};
  };
  try {
    const current = await loadWeekCalendar('2026-09-04', ['WEEK_SWITCH']);
    const next = await loadWeekCalendar('2026-09-04', ['WEEK_SWITCH'], 1);
    assert.equal(current.weekStart, '2026-09-07');
    assert.equal(current.weekEnd, '2026-09-11');
    assert.equal(next.weekStart, '2026-09-14');
    assert.equal(next.weekEnd, '2026-09-18');
    assert.deepEqual(requests.slice(10).filter(u=>u.pathname.endsWith('/earnings')).map(u=>u.searchParams.get('date')), ['2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18']);
    assert.deepEqual(requests.slice(10).filter(u=>u.pathname.endsWith('/economicevents')).map(u=>u.searchParams.get('date')), ['2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19']);
    assert.equal(await loadWeekCalendar('2026-09-04', ['WEEK_SWITCH']), current);
    assert.equal(await loadWeekCalendar('2026-09-04', ['WEEK_SWITCH'], 1), next);
    assert.equal(requests.length, 20);
    const rollover = await loadWeekCalendar('2026-12-25', ['WEEK_SWITCH'], 1);
    assert.equal(rollover.weekStart, '2027-01-04');
    assert.equal(rollover.weekEnd, '2027-01-08');
  } finally { globalThis.fetch = originalFetch; }
});

test('ET release instant respects summer/winter and Korean next day', () => {
  assert.equal(easternInstant('2026-09-11', '08:30').toISOString(), '2026-09-11T12:30:00.000Z');
  assert.equal(easternInstant('2026-01-09', '08:30').toISOString(), '2026-01-09T13:30:00.000Z');
  assert.equal(easternInstant('2026-09-11', '14:00').toISOString(), '2026-09-11T18:00:00.000Z');
  assert.equal(easternDate(new Date('2026-09-12T01:00:00Z')), '2026-09-11');
});
test('Friday morning in Korea is Thursday in ET; the flag selects today’s date', () => {
  const instant = new Date('2026-09-11T00:04:00Z');
  assert.equal(calendarDate(instant, 'ko'), '2026-09-11');
  assert.equal(calendarDate(instant, 'en'), '2026-09-10');
  assert.equal(calendarZoneLabel('ko'), 'KST');
  assert.equal(calendarZoneLabel('en'), 'ET');
});
test('macro display dates follow local midnight and US daylight saving time', () => {
  assert.deepEqual(eventDisplayTime(event({date:'2026-09-10'}), 'ko'), {date:'2026-09-10',time:'21:30',zone:'KST'});
  assert.deepEqual(eventDisplayTime(event({date:'2026-09-10',timeEt:'11:00'}), 'ko'), {date:'2026-09-11',time:'00:00',zone:'KST'});
  assert.deepEqual(eventDisplayTime(event({date:'2026-01-09',timeEt:'10:00'}), 'ko'), {date:'2026-01-10',time:'00:00',zone:'KST'});
  assert.deepEqual(eventDisplayTime(event({date:'2026-01-09'}), 'ko'), {date:'2026-01-09',time:'22:30',zone:'KST'});
  assert.deepEqual(eventDisplayTime(event({date:'2026-09-10',timeEt:'14:00'}), 'en'), {date:'2026-09-10',time:'14:00',zone:'ET'});
});
test('earnings session moves US after-market to Korea’s next date without inventing a time', () => {
  const earnings = {date:'2026-09-10',symbol:'ADBE',session:'AFTER'};
  assert.deepEqual(earningsDisplayDate(earnings, 'ko'), {date:'2026-09-11',zone:'KST'});
  assert.deepEqual(earningsDisplayDate({...earnings,date:'2026-12-31'}, 'ko'), {date:'2027-01-01',zone:'KST'});
  assert.deepEqual(earningsDisplayDate({...earnings,session:'PRE'}, 'ko'), {date:'2026-09-10',zone:'KST'});
  assert.deepEqual(earningsDisplayDate(earnings, 'en'), {date:'2026-09-10',zone:'ET'});
});
test('date-only events keep their explicit ET date instead of a guessed Korean date', () => {
  assert.deepEqual(eventDisplayTime(event({timeEt:''}), 'ko'), {date:'2026-09-11',time:'',zone:'ET'});
  assert.deepEqual(earningsDisplayDate({date:'2026-09-10',session:'UNKNOWN'}, 'ko'), {date:'2026-09-10',zone:'ET'});
});
test('Korean columns regroup events, include Saturday spillover, and preserve provider data', () => {
  const thursday = event({date:'2026-09-10',name:'PPI'});
  const afternoon = event({date:'2026-09-10',name:'FOMC Statement',kind:'event',timeEt:'14:00'});
  const friday = event({name:'CPI'});
  const saturday = event({name:'Late release',timeEt:'14:00'});
  const earnings = {date:'2026-09-10',symbol:'ADBE',session:'AFTER'};
  const calendar = week([day({date:'2026-09-10',events:[thursday,afternoon],earnings:[earnings]}),day({events:[friday,saturday]})]);
  const original = structuredClone(calendar);
  const ko = calendarDisplayDays(calendar, 'ko');
  assert.deepEqual(ko.map(d=>d.date), ['2026-09-10','2026-09-11','2026-09-12']);
  assert.deepEqual(ko[0].events.map(e=>e.name), ['PPI']);
  assert.deepEqual(ko[1].events.map(e=>e.name), ['FOMC Statement','CPI']);
  assert.equal(ko[1].earnings[0], earnings);
  assert.equal(ko[2].events[0], saturday);
  assert.deepEqual(calendar, original);
  assert.equal(ko[1].events[0].date, '2026-09-10');
  assert.equal(releaseState(ko[1].events[0], Date.parse('2026-09-10T17:59:00Z')), 'scheduled');
  const en = calendarDisplayDays(calendar, 'en');
  assert.deepEqual(en.map(d=>d.date), ['2026-09-10','2026-09-11']);
  assert.equal(en[0].earnings[0], earnings);
});
test('feed failures retain their source ET date on all affected Korean dates', () => {
  const source = day({date:'2026-09-11',earningsStatus:'error',earningsCheckedAt:null});
  const ko = calendarDisplayDays(week([source]), 'ko');
  assert.deepEqual(ko.map(d=>d.date), ['2026-09-11','2026-09-12']);
  for (const d of ko) {
    assert.equal(d.sources[0].date, '2026-09-11');
    assert.equal(d.sources[0].earningsStatus, 'error');
    assert.equal(d.sources[0].earningsCheckedAt, null);
  }
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
