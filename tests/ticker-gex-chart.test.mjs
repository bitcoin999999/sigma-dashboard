import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require=createRequire(import.meta.url);
function compile(path, resolve=require) {
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const compiled={exports:{}};
  new Function('require','module','exports',code)(resolve,compiled,compiled.exports);
  return compiled.exports;
}
const floor=compile('../lib/gex-floor.ts');
const gex=compile('../lib/gex-chart-levels.ts',id=>id==='./gex-floor'?floor:require(id));
const search=compile('../lib/ticker-search.ts');
const cal=compile('../lib/calendar-state.ts');
const chart=compile('../lib/weekly-chart.ts',id=>id==='./calendar-state'?cal:require(id));
const refresh=compile('../lib/weekly-chart-refresh.ts',id=>id==='./calendar-state'?cal:require(id));
const sigma=compile('../lib/sigma.ts');
const level=(strike,netGex)=>({strike,netGex});
const profile=(support=[],resistance=[],rows=[...support,...resistance])=>({asOf:'2026-09-15',support,resistance,profile:rows});

test('ticker directory is small, unique, alphabetical and matches ticker prefixes and company names case-insensitively',()=>{
  const items=search.tickerDirectory([{symbol:'AVGO',name:'Broadcom',history:['large']},{symbol:'ASML',name:'ASML'},{symbol:'AAPL',name:'Apple'},{symbol:'AVGO',name:'Broadcom'},{symbol:'META',name:'Meta'}]);
  assert.deepEqual(search.matchingTickers(items,' a ').map(i=>i.symbol),['AAPL','ASML','AVGO','META']);
  assert.deepEqual(search.matchingTickers(items,'AV').map(i=>i.symbol),['AVGO']);
  assert.deepEqual(search.matchingTickers(items,''),[]);
  assert.deepEqual(search.matchingTickers(items,'XYZ'),[]);
  assert.deepEqual(search.matchingTickers(items,'broadcom').map(i=>i.symbol),['AVGO']);
  assert.ok(items.every(i=>Object.keys(i).length===2));
});
test('missing or one-sided GEX never invents the other side',()=>{
  assert.deepEqual(gex.selectGexChartLevels(undefined),[]);
  const rows=gex.selectGexChartLevels(profile([level(95,100)]));
  assert.equal(rows.length,1);assert.equal(rows[0].role,'support');
  assert.equal(rows[0].dominance,null);assert.equal(rows[0].strong,true);
  assert.equal(JSON.parse(JSON.stringify(rows))[0].dominance,null);
});
test('invalid levels are removed, duplicates keep maximum and roles that conflict are both excluded',()=>{
  const rows=gex.selectGexChartLevels(profile([level(90,20),level(95,100),level(90,40),level(0,5),level(-5,8),level(NaN,9),level(Infinity,2),level(92,-1),level(93,0),level(94,Infinity),level(96,NaN)],[level(95,50),level(110,200)]),{maxPerSide:2});
  assert.deepEqual(rows.map(i=>[i.role,i.price,i.netGex]),[['support',90,40],['resistance',110,200]]);
});
test('ranking uses positive netGex, preserves upstream role and highlights only a comparable primary',()=>{
  const rows=gex.selectGexChartLevels(profile([level(95,10),level(80,100),level(90,20)],[level(120,300)]),{maxPerSide:2});
  assert.deepEqual(rows.map(i=>i.price),[80,90,120]);assert.equal(rows[0].dominance,5);assert.equal(rows[0].strong,true);assert.equal(rows[1].strong,false);
  assert.equal(rows[0].role,'support'); // No current-price reclassification.
  const bad=gex.selectGexChartLevels(profile([level(95,100)],[],[level(95,1)]))[0];
  assert.equal(bad.sharePercent,null);assert.equal(bad.strong,false);
  assert.equal(gex.selectGexChartLevels(profile([level(95,100)],[],[]))[0].sharePercent,null);
});
test('levels display even without sigma confluence, and snapshot carries OI date separately from chart week',()=>{
  const stock=sigma.buildStockData({symbol:'TEST',name:'Test',sector:'Test',anchor:100,sigmaPercent:5,price:100,previousClose:100,history:[],gex:profile([level(90,100)],[level(110,80)])});
  assert.equal(floor.findGexFloor(stock),null);
  const packet=gex.buildGexChartSnapshot(stock,'2026-09-14','2026-09-14');
  assert.equal(packet.levels.length,2);assert.equal(packet.floorStrike,null);assert.equal(packet.oiAsOf,'2026-09-15');
});
test('sigma conversion preserves thresholds while only the nearest sigma expands the candle scale',()=>{
  const stock=sigma.buildStockData({anchor:100,sigmaPercent:5,price:108,previousClose:100});
  assert.equal(stock.sigma1Lower,95);assert.equal(stock.sigmaExtremeUpper,107.5);assert.equal(stock.status,'OVERHEATED');
  assert.deepEqual(sigma.sigmaPriceRange(100,5,2),{lower:90,upper:110});
  const band={anchor:100,lower:95,upper:105,lower2:90,upper2:110};
  assert.deepEqual(chart.candleDomain([{low:99,high:101}],band),[94.28,101.72]);
  const fit=chart.candleDomain([{low:99,high:101}],band,[150],'all');assert.ok(fit[1]>150);
});
test('colliding labels are separated without changing the underlying price values',()=>{
  const labels=gex.separatePriceLabels([{value:100},{value:100},{value:100.001},{value:101}],p=>p,10,270);
  for(let i=1;i<labels.length;i++)assert.ok(labels[i].labelY-labels[i-1].labelY>=22);
  assert.deepEqual(labels.map(i=>i.value),[100,100,100.001,101]);
});
test('plot renders S1/R1 and OI date, leaves distant GEX off scale and hides other-week snapshots',()=>{
  const {WeeklyCandlePlot}=compile('../components/dashboard/weekly-price-chart.tsx',id=>{
    if(id==='@/components/locale-provider')return {useLocale:()=>({locale:'ko',pick:ko=>ko})};
    if(id==='@/lib/gex-chart-levels')return gex;
    if(id==='@/lib/weekly-chart')return chart;
    if(id==='@/lib/weekly-chart-refresh')return refresh;
    if(id==='@/lib/format')return compile('../lib/format.ts');
    return require(id);
  });
  const data={symbol:'TEST',weekStart:'2026-09-14',weekEnd:'2026-09-18',dates:['2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18'],candles:[{timestamp:1,date:'2026-09-14',time:'09:30',slot:0,open:100,high:102,low:98,close:101,complete:true}]};
  const packet={weekStart:data.weekStart,floorWeekStart:data.weekStart,floorStrike:95,oiAsOf:'2026-09-15',levels:gex.selectGexChartLevels(profile([level(95,100),level(90,10)],[level(150,200)]),{maxPerSide:2})};
  const band={weekStart:data.weekStart,anchor:100,lower:95,upper:105,lower2:90,upper2:110};
  const html=renderToStaticMarkup(React.createElement(WeeklyCandlePlot,{data,band,gex:packet}));
  assert.match(html,/두 번째 지지/);assert.match(html,/GEX S1/);assert.match(html,/GEX R1/);assert.match(html,/축 밖/);assert.match(html,/OI 2026-09-15/);assert.match(html,/−1σ 합치/);
  assert.match(html,/role="status" aria-label="시가 \$100\.00, 고가 \$102\.00, 저가 \$98\.00, 종가 \$101\.00"/);
  assert.match(html,/var\(--gex-support\)/);assert.match(html,/var\(--gex-resistance\)/);
  assert.match(html,/\+1σ \$105\.00/);assert.match(html,/−1σ \$95\.00/);
  assert.doesNotMatch(html,/\+2σ \$110\.00|−2σ \$90\.00|미검증|unvalidated|과거 시점별|historical GEX/);
  const nearTwo=renderToStaticMarkup(React.createElement(WeeklyCandlePlot,{data:{...data,candles:[{...data.candles[0],open:109,low:108,high:111,close:110}]},band}));
  assert.match(nearTwo,/\+2σ \$110\.00/);
  assert.match(nearTwo,/\+1σ \$105\.00/);
  assert.doesNotMatch(nearTwo,/−2σ \$90\.00|−1σ \$95\.00/);
  assert.doesNotMatch(html,/>GEX S2/);
  const old=renderToStaticMarkup(React.createElement(WeeklyCandlePlot,{data,band,gex:{...packet,weekStart:'2026-09-07'}}));
  assert.doesNotMatch(old,/GEX S1/);assert.doesNotMatch(old,/OI 2026-09-15/);
  const rolled=renderToStaticMarkup(React.createElement(WeeklyCandlePlot,{data,band,gex:{...packet,floorWeekStart:'2026-09-21'}}));
  assert.doesNotMatch(rolled,/−1σ 합치/);
});
