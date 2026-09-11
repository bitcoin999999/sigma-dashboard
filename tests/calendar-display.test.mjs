import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function compile(relativePath, resolve = require) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolve, compiled, compiled.exports);
  return compiled.exports;
}
const calendarState = compile('../lib/calendar-state.ts');
const utils = compile('../lib/utils.ts');
const stamp = '2026-09-11T00:04:00Z'; // Screenshot: Friday 09:04 KST / Thursday 20:04 ET.
const event = (date, name, timeEt) => ({date,name,timeEt,tier:1,kind:'print',actual:null,forecast:'0.2%',previous:null});
const calendar = {
  weekStart:'2026-09-07',weekEnd:'2026-09-11',todayEt:'2026-09-10',checkedAt:stamp,
  days: ['07','08','09','10','11'].map(d => ({
    date:`2026-09-${d}`,macroStatus:'ok',earningsStatus:'ok',macroCheckedAt:stamp,earningsCheckedAt:stamp,
    events: d === '10' ? [event('2026-09-10','PPI','08:30')] : d === '11' ? [event('2026-09-11','CPI','08:30')] : [],
    earnings: d === '10' ? [{date:'2026-09-10',symbol:'ADBE',name:'Adobe',session:'AFTER',epsForecast:'$4.86'}] : [],
  })),
};
function render(locale) {
  const { WeekCalendar } = compile('../components/dashboard/week-calendar.tsx', id => {
    if (id === '@/components/locale-provider') return { useLocale: () => ({locale,pick:(ko,en)=>locale==='ko'?ko:en}) };
    if (id === '@/lib/calendar-state') return calendarState;
    if (id === '@/lib/utils') return utils;
    return require(id);
  });
  return renderToStaticMarkup(React.createElement(WeekCalendar,{calendar,bandAnchorDate:'2026-09-04',onSelect:()=>{}}));
}
test('Korean calendar renders Friday as today and moves Thursday after-market earnings into Friday', () => {
  const html = render('ko');
  assert.match(html, /날짜는 KST 기준/);
  assert.match(html, /다음 주 보기/);
  assert.match(html, /금 9\/11<\/span><span[^>]*>오늘 · KST/);
  assert.doesNotMatch(html, /오늘 · ET/);
  assert.match(html, /id="earnings-2026-09-11"[^]*ADBE/);
  assert.doesNotMatch(html, /id="earnings-2026-09-10"[^]*?ADBE[^]*?id="day-2026-09-11"/);
  assert.match(html, /21:30 KST/);
  assert.match(html, /미국 장후/);
});
test('English calendar keeps Thursday today, the US earnings date and ET as the primary clock', () => {
  const html = render('en');
  assert.match(html, /Dates in ET/);
  assert.match(html, /View next week/);
  assert.match(html, /Thu 9\/10<\/span><span[^>]*>Today · ET/);
  assert.match(html, /id="earnings-2026-09-10"[^]*?ADBE[^]*?id="day-2026-09-11"/);
  assert.match(html, /08:30 ET/);
});
