import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function compile(path, resolve = require) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolve, compiled, compiled.exports);
  return compiled.exports;
}
const calendar = compile('../lib/calendar-state.ts');
const chart = compile('../lib/weekly-chart.ts', id => id === './calendar-state' ? calendar : require(id));
const { chartWeek, parseWeeklyChart, candleDomain } = chart;
const refresh = compile('../lib/weekly-chart-refresh.ts', id => id === './calendar-state' ? calendar : require(id));
const sigma = compile('../lib/sigma.ts');
const gexFloor = compile('../lib/gex-floor.ts');
const gexChart = compile('../lib/gex-chart-levels.ts', id => id === './gex-floor' ? gexFloor : require(id));
const { buildChartBands } = compile('../lib/weekly-chart-bands.ts', id => id === './sigma' ? sigma : require(id));
const resolveServer = id => id === './weekly-chart' ? chart : id === './weekly-chart-refresh' ? refresh : require(id);
const seconds = (date, time) => calendar.easternInstant(date, time).getTime() / 1000;
const now = new Date('2026-09-16T04:00:00Z');
const candle = (date, time, overrides = {}) => ({ timestamp: seconds(date, time), open: 100, high: 103, low: 99, close: 102, ...overrides });
function response(bars, { symbol = 'SOXX', earlyClose, dates } = {}) {
  return { chart: { error: null, result: [{
    meta: { symbol, exchangeTimezoneName: 'America/New_York', dataGranularity: '30m',
      tradingPeriods: (dates ?? [...new Set(bars.map(bar => calendar.easternDate(new Date(bar.timestamp * 1000))))]).map(date => [
        { start: seconds(date, '09:30'), end: seconds(date, earlyClose ?? '16:00') },
      ]),
    },
    timestamp: bars.map(bar => bar.timestamp),
    indicators: { quote: [Object.fromEntries(['open', 'high', 'low', 'close'].map(key => [key, bars.map(bar => bar[key])]))] },
  }] } };
}
function session(date) {
  return Array.from({ length: 13 }, (_, index) => candle(date, `${Math.floor((570 + index * 30) / 60)}:${String((570 + index * 30) % 60).padStart(2, '0')}`));
}

test('ET calendar week keeps Friday through Sunday and rolls at Monday ET, including year boundary', () => {
  for (const date of ['2026-09-18T21:00:00Z', '2026-09-20T15:00:00Z', '2026-09-21T03:59:00Z']) {
    assert.equal(chartWeek(new Date(date)).weekStart, '2026-09-14');
  }
  assert.deepEqual(chartWeek(new Date('2026-09-21T04:00:00Z')).dates, ['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25']);
  assert.equal(chartWeek(new Date('2027-01-01T18:00:00Z')).weekStart, '2026-12-28');
});

test('Monday and Tuesday occupy 26 of 65 slots; exclude previous week, extended hours, closing marker and future bars', () => {
  const bars = [candle('2026-09-11','15:30'), candle('2026-09-14','09:00'), ...session('2026-09-14'),
    ...session('2026-09-15'), candle('2026-09-15','16:00'), candle('2026-09-15','17:00'), candle('2026-09-16','09:30')];
  const parsed = parseWeeklyChart(response(bars), 'SOXX', now);
  assert.equal(parsed.candles.length, 26);
  assert.deepEqual(parsed.candles.map(bar => bar.slot), Array.from({ length: 26 }, (_, i) => i));
  assert.equal(parsed.candles.at(-1).time, '15:30');
  assert.equal(parsed.dates.length, 5);
  assert.equal(chart.WEEK_SLOTS, 65);
});

test('complete week fills exactly 65 regular-session candles', () => {
  const parsed = parseWeeklyChart(response(chartWeek(now).dates.flatMap(session)), 'SOXX', new Date('2026-09-19T10:00:00Z'));
  assert.equal(parsed.candles.length, 65);
  assert.equal(parsed.candles.at(-1).slot, 64);
});

test('holiday Monday stays empty instead of moving Tuesday into Monday; preopen never reuses last week', () => {
  const parsed = parseWeeklyChart(response(session('2026-09-08')), 'SOXX', new Date('2026-09-09T04:00:00Z'));
  assert.equal(parsed.candles[0].slot, 13);
  assert.equal(parsed.candles.length, 13);
  const preopen = parseWeeklyChart(response(session('2026-09-11')), 'SOXX', new Date('2026-09-14T12:00:00Z'));
  assert.equal(preopen.candles.length, 0);
  assert.equal(preopen.weekStart, '2026-09-14');
});

test('early close has seven bars and no synthetic 13:00 candle; DST maps winter open to 09:30', () => {
  const bars = session('2026-11-27');
  assert.equal(new Date(bars[0].timestamp * 1000).toISOString(), '2026-11-27T14:30:00.000Z');
  const parsed = parseWeeklyChart(response(bars, { earlyClose: '13:00' }), 'SOXX', new Date('2026-11-28T06:00:00Z'));
  assert.equal(parsed.candles.length, 7);
  assert.equal(parsed.candles.at(-1).time, '12:30');
  assert.equal(parsed.candles[0].slot, 52);
});

test('forming candle is marked incomplete until its 30-minute interval ends', () => {
  const raw = response([candle('2026-09-14', '09:30')]);
  assert.equal(parseWeeklyChart(raw, 'SOXX', new Date('2026-09-14T13:45:00Z')).candles[0].complete, false);
  assert.equal(parseWeeklyChart(raw, 'SOXX', new Date('2026-09-14T14:00:00Z')).candles[0].complete, true);
});

test('missing/invalid OHLC stays a gap; duplicates are unique and sorted', () => {
  const bars = [candle('2026-09-14','11:00'), candle('2026-09-14','09:30'), candle('2026-09-14','10:00',{close:null}),
    candle('2026-09-14','10:30',{high:99}), candle('2026-09-14','11:30',{low:0}), candle('2026-09-14','09:30',{close:101})];
  const parsed = parseWeeklyChart(response(bars), 'SOXX', now);
  assert.deepEqual(parsed.candles.map(bar => bar.slot), [0, 3]);
  assert.equal(parsed.candles[0].close, 101);
});

test('upstream errors, wrong symbols/granularity/zone, missing OHLC and session metadata fail explicitly', () => {
  assert.throws(() => parseWeeklyChart({chart:{error:{code:'Not Found'}}}, 'SOXX', now));
  for (const patch of [{symbol:'SPY'}, {dataGranularity:'1d'}, {exchangeTimezoneName:'Asia/Seoul'}, {tradingPeriods:[]}]) {
    const raw = response(session('2026-09-14'));
    Object.assign(raw.chart.result[0].meta, patch);
    assert.throws(() => parseWeeklyChart(raw, 'SOXX', now));
  }
  const raw = response(session('2026-09-14'));
  delete raw.chart.result[0].indicators.quote[0].open;
  assert.throws(() => parseWeeklyChart(raw, 'SOXX', now));
  assert.equal(parseWeeklyChart(response([]), 'SOXX', now).candles.length, 0);
});

test('price domain includes all wicks with padding, does not start at zero, and survives a flat candle', () => {
  assert.deepEqual(candleDomain([{low:490,high:510}]), [487.6, 512.4]);
  const [low, high] = candleDomain([{low:500,high:500}]);
  assert.ok(low < 500 && high > 500 && high - low < 1);
  assert.deepEqual(candleDomain([]), [0, 1]);
});

test('server coalesces same-symbol requests, separates symbols, validates input and briefly caches errors', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  const { loadWeeklyChart } = compile('../lib/weekly-chart-server.ts', resolveServer);
  try {
    globalThis.fetch = async url => {
      calls++;
      const symbol = decodeURIComponent(new URL(url).pathname.split('/').at(-1));
      await new Promise(resolve => setTimeout(resolve, 5));
      return Response.json(response([], {symbol}));
    };
    const [first, second] = await Promise.all([loadWeeklyChart('SOXX'), loadWeeklyChart('SOXX')]);
    assert.strictEqual(first, second);
    assert.equal(calls, 1);
    await loadWeeklyChart('SPY');
    assert.equal(calls, 2);
    await assert.rejects(loadWeeklyChart('../invalid'));
    assert.equal(calls, 2);
    globalThis.fetch = async () => { calls++; return new Response('', {status:429}); };
    await assert.rejects(loadWeeklyChart('FAIL'));
    await assert.rejects(loadWeeklyChart('FAIL'));
    assert.equal(calls, 3);
  } finally { globalThis.fetch = original; }
});

test('weekly plot renders 26 real candles, five weekday slots and bilingual OHLC/ET labels', () => {
  const data = parseWeeklyChart(response([...session('2026-09-14'), ...session('2026-09-15')]), 'SOXX', now);
  for (const locale of ['ko', 'en']) {
    const { WeeklyCandlePlot } = compile('../components/dashboard/weekly-price-chart.tsx', id => {
      if (id === '@/components/locale-provider') return {useLocale:()=>({locale,pick:(ko,en)=>locale === 'ko' ? ko : en})};
      if (id === '@/lib/gex-chart-levels') return gexChart;
      if (id === '@/lib/weekly-chart') return chart;
      if (id === '@/lib/weekly-chart-refresh') return refresh;
      if (id === '@/lib/format') return compile('../lib/format.ts');
      return require(id);
    });
    const html = renderToStaticMarkup(React.createElement(WeeklyCandlePlot, {data}));
    assert.equal((html.match(/fill="var\(--up\)"/g) ?? []).length, 26);
    for (const date of ['9/14','9/15','9/16','9/17','9/18']) assert.ok(html.includes(date));
    assert.match(html, locale === 'ko' ? /2026-09-16 04:30 KST/ : /2026-09-15 15:30 ET/);
    assert.ok(html.includes(locale === 'ko' ? '시가' : 'Open'));
    assert.ok(html.includes(locale === 'ko' ? '완성 봉' : 'Closed candle'));
    assert.match(html, /tabindex="0"/);
  }
});

test('chart route shares successful responses in CDN/browser caches, isolates weeks and never caches errors', async () => {
  const calls = [];
  const { GET } = compile('../app/api/weekly-chart/[symbol]/route.ts', id => {
    if (id === '@/lib/weekly-chart-server') return {loadWeeklyChart: async symbol => {
      calls.push(symbol);
      if (symbol === 'FAIL') throw new Error('Upstream unavailable');
      return {symbol,fetchedAt:new Date().toISOString()};
    }};
    if (id === '@/lib/gex-chart-levels') return gexChart;
      if (id === '@/lib/weekly-chart') return chart;
    if (id === '@/lib/weekly-chart-refresh') return refresh;
    return require(id);
  });
  const get = (symbol, query = '') => GET(new Request(`http://localhost/${query}`), {params:Promise.resolve({symbol})});
  const success = await get('soxx');
  assert.equal(success.status, 200);
  assert.equal((await success.json()).symbol, 'SOXX');
  assert.match(success.headers.get('Cache-Control'), /^public, max-age=\d+, must-revalidate$/);
  assert.match(success.headers.get('Vercel-CDN-Cache-Control'), /^public, s-maxage=\d+, must-revalidate$/);
  assert.equal((await get('../bad')).status, 400);
  assert.deepEqual(calls, ['SOXX']);
  const wrongWeek = await get('SOXX', '?week=2020-01-01');
  assert.equal(wrongWeek.status, 409);
  assert.equal(wrongWeek.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(calls, ['SOXX']);
  const log = console.error;
  try {
    console.error = () => {};
    const failure = await get('FAIL');
    assert.equal(failure.status, 503);
    assert.equal(failure.headers.get('Cache-Control'), 'no-store');
  } finally { console.error = log; }
});

test('automatic requests drop to two per trading hour; focus events cannot multiply them', () => {
  let last = seconds('2026-09-16','12:32') * 1000;
  const calls = [];
  for (let minute = 0; minute < 60; minute++) {
    const now = new Date(seconds('2026-09-16', `13:${String(minute).padStart(2,'0')}`) * 1000);
    for (let focus = 0; focus < 10; focus++) {
      if (refresh.shouldRefreshChart(now, last)) { calls.push(now); last = now.getTime(); }
    }
  }
  assert.deepEqual(calls.map(at=>calendar.partsIn('America/New_York',at).minute), [2,32]);
  assert.equal((60-calls.length)/60, 58/60);
});

test('no automatic requests before/after trading or on weekends; initial read and final candle still work', () => {
  const last = seconds('2026-09-16', '09:32') * 1000;
  for (const at of ['2026-09-16T12:00:00Z','2026-09-16T20:33:00Z','2026-09-19T14:02:00Z','2026-09-20T14:32:00Z']) {
    assert.equal(refresh.shouldRefreshChart(new Date(at), last), false);
  }
  assert.equal(refresh.shouldRefreshChart(new Date('2026-09-16T20:02:00Z'), last), true);
  assert.equal(refresh.shouldRefreshChart(new Date('2026-09-19T14:02:00Z'), null), true);
  assert.equal(refresh.shouldRefreshChart(new Date('2026-11-16T14:02:00Z'), last), false); // winter 09:02
  assert.equal(refresh.shouldRefreshChart(new Date('2026-11-16T14:32:00Z'), last), true);
});

test('all cache layers expire at the same bar boundary, never 30 minutes after an old cache hit', () => {
  assert.equal(refresh.CHART_REFRESH_MS, 1_800_000);
  const stamp = '2026-09-16T14:02:00Z';
  assert.equal(refresh.chartCacheSeconds(stamp, new Date(stamp)), 1800);
  assert.equal(refresh.chartCacheSeconds(stamp, new Date('2026-09-16T14:22:00Z')), 600);
  assert.equal(refresh.chartCacheSeconds(stamp, new Date('2026-09-16T14:32:00Z')), 0);
  assert.equal(refresh.chartCacheSeconds(stamp, new Date('2026-09-16T15:00:00Z')), 0);
});

test('server cache survives the old one-minute TTL and refetches on the next 30-minute boundary', async t => {
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-09-16T14:02:00Z').getTime()});
  const original = globalThis.fetch;
  let calls = 0;
  const { loadWeeklyChart } = compile('../lib/weekly-chart-server.ts', resolveServer);
  try {
    globalThis.fetch = async () => {calls++;return Response.json(response([]));};
    await loadWeeklyChart('SOXX');
    t.mock.timers.tick(61_000);
    await loadWeeklyChart('SOXX');
    assert.equal(calls,1);
    t.mock.timers.tick(1_740_000);
    await loadWeeklyChart('SOXX');
    assert.equal(calls,2);
  } finally {globalThis.fetch=original;t.mock.timers.reset();}
});

test('chart bands reuse page prices and use the settled band after Friday rollover', () => {
  const stock = sigma.buildStockData({symbol:'SOXX',name:'SOXX',sector:'ETF',price:500,previousClose:500,
    anchor:500,sigmaPercent:4,history:[],lastWeek:{anchorDate:'2026-09-11',anchor:480,sigmaPercent:5,closes:[]}});
  const bands = buildChartBands(stock,'2026-09-18');
  assert.deepEqual(bands[0], {weekStart:'2026-09-21',anchorDate:'2026-09-18',anchor:500,lower:stock.sigma1Lower,upper:stock.sigma1Upper,lower2:460,upper2:540});
  const settled = bands.find(band=>band.weekStart === '2026-09-14');
  assert.deepEqual([settled.lower,settled.upper],[456,504]);
  assert.equal(bands.some(band=>band.weekStart === '2026-09-07'),false);
});

test('price scale keeps ±1σ on demand and switches to the breached side window', () => {
  const band={weekStart:'2026-09-14',anchorDate:'2026-09-11',anchor:500,lower:475,upper:525,lower2:450,upper2:550};
  const fit=candleDomain([{low:490,high:510}],band,[],'sigma');
  assert.deepEqual(fit,[469,531]);
  assert.deepEqual(chart.chartScaleMode(510,band),'normal');
  const upper=candleDomain([{low:530,high:540,close:535}],band,[],'sigma');
  assert.deepEqual(upper,[494,556]);
  assert.equal(chart.chartScaleMode(535,band),'upper-breakout');
  const lower=candleDomain([{low:460,high:470,close:465}],band,[],'sigma');
  assert.deepEqual(lower,[447,478]);
  assert.equal(chart.chartScaleMode(465,band),'lower-breakout');
  // An empty week has no candle range to honour, so it falls back to the band.
  assert.deepEqual(candleDomain([],band),[469,531]);
});

test('the default scale follows the candles and only reaches for the nearest sigma line', () => {
  const band={weekStart:'2026-09-14',anchorDate:'2026-09-11',anchor:500,lower:475,upper:525,lower2:450,upper2:550};
  // −1σ already sits inside the week's own range, so nothing is stretched.
  assert.deepEqual(candleDomain([{low:470,high:480}],band),[468.8,481.2]);
  // A week that trades far from its anchor pulls in one line, not the whole band.
  assert.deepEqual(candleDomain([{low:495,high:500}],band),[472,503]);
  // Equidistant sigma lines resolve downward.
  const tie=candleDomain([{low:499,high:501}],band);
  assert.ok(tie[0] < 475 && tie[1] < 525);
  // GEX strikes only widen the axis when the reader asks for them.
  assert.equal(candleDomain([{low:495,high:500}],band,[600])[1] > 600, false);
  assert.ok(candleDomain([{low:495,high:500}],band,[600],'all')[1] > 600);
});

test('gridline prices land on round steps inside the domain', () => {
  assert.deepEqual(chart.priceTicks(149.13,152.59,6),[150,151,152]);
  assert.deepEqual(chart.priceTicks(0,10,6),[0,2,4,6,8,10]);
  assert.deepEqual(chart.priceTicks(5,5),[]);
});

test('rendered chart labels visible sigma prices without duplicating calculations or drawing a different week', () => {
  const data=parseWeeklyChart(response(session('2026-09-14')),'SOXX',now);
  const band={weekStart:'2026-09-14',anchorDate:'2026-09-11',anchor:101,lower:99,upper:103,lower2:97,upper2:105};
  const {WeeklyCandlePlot}=compile('../components/dashboard/weekly-price-chart.tsx',id=>{
    if(id==='@/components/locale-provider')return {useLocale:()=>({locale:'ko',pick:ko=>ko})};
    if(id==='@/lib/gex-chart-levels')return gexChart;
    if(id==='@/lib/weekly-chart')return chart;
    if(id==='@/lib/weekly-chart-refresh')return refresh;
    if(id==='@/lib/format')return compile('../lib/format.ts');
    return require(id);
  });
  const html=renderToStaticMarkup(React.createElement(WeeklyCandlePlot,{data,band}));
  assert.match(html,/\+1σ \$103\.00/);
  assert.match(html,/−1σ \$99\.00/);
  const different=renderToStaticMarkup(React.createElement(WeeklyCandlePlot,{data,band:{...band,weekStart:'2026-09-21'}}));
  assert.doesNotMatch(different,/\+1σ \$103\.00/);
  assert.match(different,/해당 주의 1σ 데이터가 없습니다/);
});

 test('chart timestamps respect Korean midnight rollover and US daylight saving', () => {
  assert.equal(chart.chartTimeLabel(new Date('2026-09-15T19:30:00Z'),'ko'),'2026-09-16 04:30 KST');
  assert.equal(chart.chartTimeLabel(new Date('2026-09-15T19:30:00Z'),'en'),'2026-09-15 15:30 ET');
  assert.equal(chart.chartTimeLabel(new Date('2026-12-15T20:30:00Z'),'ko'),'2026-12-16 05:30 KST');
  assert.equal(chart.chartTimeLabel(new Date('2026-12-15T20:30:00Z'),'en'),'2026-12-15 15:30 ET');
});
test('the ±1σ scale flips to the breached side window', () => {
  const band={anchor:100,lower:95,upper:105,lower2:90,upper2:110};
  assert.deepEqual(candleDomain([{low:103,high:106,close:104}],band,[],'sigma'),[93.68,107.32]);
  const upper=candleDomain([{low:106,high:108,close:107}],band,[],'sigma');
  assert.deepEqual(upper,[98.8,111.2]);
  const lower=candleDomain([{low:92,high:94,close:93}],band,[],'sigma');
  assert.deepEqual(lower,[89.4,95.6]);
  const beyond=candleDomain([{low:115,high:116,close:115}],band,[],'sigma');
  assert.deepEqual(beyond,[98.08,117.92]);
});
