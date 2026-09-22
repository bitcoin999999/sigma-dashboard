import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url), root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cache=new Map();
function load(file){
  file=resolve(root,file);if(cache.has(file))return cache.get(file).exports;
  const mod={exports:{}};cache.set(file,mod);
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(id=>id.startsWith('.')?load(resolve(dirname(file),`${id}${existsSync(resolve(dirname(file),`${id}.ts`))?'.ts':'.tsx'}`)):require(id),mod,mod.exports);return mod.exports;
}
const sigma=load('lib/sigma.ts'),summary=load('lib/watchlist-summary.ts'),changes=load('lib/watchlist-observations.ts'),portfolio=load('lib/portfolio.ts'),history=load('lib/market-history.ts'),dates=load('lib/market-dates.ts'),sharing=load('lib/share-image.ts'),storage=load('lib/local-document.ts');
const row=(zScore,symbol='AAA')=>({symbol,zScore,snapshotId:'one',bandStart:'2026-09-11',bandEnd:'2026-09-18',observedAt:'2026-09-14',methodVersion:'v1:anchor',priceBasis:'regular'});
const quote={symbol:'AAA',name:'A',sector:'Test',price:120,previousClose:110,anchor:100,sigmaPercent:10,history:[],sigmaBasis:{fromAnchor:true,scaled:false}};
test('equal weighting: +2 and -2 cancel but absolute mean stays 2 and both are outside',()=>{
  const s=summary.summarizeWatchlistSigma([row(2),row(-2,'BBB')]);assert.equal(s.meanSigma,0);assert.equal(s.meanAbsoluteSigma,2);assert.equal(s.outsideCount,2);
});
test('0, 1, 20 and missing quotes preserve denominators without inventing zeros',()=>{
  assert.equal(summary.summarizeWatchlistSigma([]).meanSigma,null);
  assert.equal(summary.summarizeWatchlistSigma([row(2)]).meanSigma,2);
  assert.equal(summary.summarizeWatchlistSigma(Array.from({length:20},(_,i)=>row(i%2?2:-2,`T${i}`))).validCount,20);
  const s=summary.summarizeWatchlistSigma([row(2),row(null,'GONE')]);assert.equal(s.meanSigma,2);assert.equal(s.totalCount,2);assert.equal(s.validCount,1);
  assert.equal(summary.summarizeWatchlistSigma([row(null)]).meanSigma,null);
});
test('raw +/-1 boundaries and approaching 0.85 reuse existing status decisions',()=>{
  for(const z of [1,-1,1.00001,-1.00001])assert.equal(sigma.isOutsideSigma(z),true);
  for(const z of [0.99999,-0.99999,0,NaN])assert.equal(sigma.isOutsideSigma(z),false);
  assert.equal(sigma.isApproachingSigma(.85),true);assert.equal(sigma.isApproachingSigma(1),false);assert.equal(sigma.isApproachingSigma(.84999),false);
  assert.equal(sigma.buildStockData({...quote,sigmaPercent:undefined}).status,'UNAVAILABLE');
});
test('different snapshots, band windows, methods and observation dates cannot share a mean',()=>{
  for(const key of ['snapshotId','bandStart','bandEnd','observedAt','methodVersion','priceBasis']){
    assert.equal(summary.summarizeWatchlistSigma([row(1),{...row(2,'BBB'),[key]:'other'}]).meanSigma,null);
    assert.equal(summary.summarizeWatchlistSigma([{...row(1),[key]:null}]).comparable,false);
  }
});
const observation=(z,id='a',date='2026-09-14')=>changes.makeObservation([{...row(z),snapshotId:id,observedAt:date}]);
test('same snapshot, first visit and corrected session never invent movements',()=>{
  const a=observation(.8);assert.equal(changes.compareObservations(null,a).state,'first');assert.equal(changes.compareObservations(a,a).state,'same');
  assert.equal(changes.compareObservations(a,observation(1.2,'b')).state,'correction');
});
test('both crossing directions, return, approaching and data recovery',()=>{
  for(const [before,after,event] of [[.82,1.12,'entered_upper_band'],[-.8,-1,'entered_lower_band'],[-1.21,-.88,'returned_inside'],[.5,.9,'approaching_upper_band'],[null,.2,'data_became_available'],[.2,null,'data_became_unavailable']]){
    assert.equal(changes.compareObservations(observation(before),observation(after,'b','2026-09-15')).changes[0].type,event);
  }
});
test('weekly reset does not emit a return and new members are not data recovery',()=>{
  const next={...observation(0,'b','2026-09-18'),bandStart:'2026-09-18',bandEnd:'2026-09-25'};
  assert.deepEqual(changes.compareObservations(observation(2),next).changes,[{type:'new_band_window'}]);
  assert.deepEqual(changes.compareObservations({...observation(0),rows:{}},observation(1,'b','2026-09-15')).changes,[]);
});
test('observation storage bounds, corruption and same snapshot preservation',()=>{
  let list=[];for(let i=14;i<20;i++)list=changes.rememberObservation(list,observation(1,String(i),`2026-09-${i}`));assert.equal(list.length,4);
  assert.strictEqual(changes.rememberObservation(list,list[0]),list);assert.throws(()=>changes.parseObservations('broken'));assert.throws(()=>changes.parseObservations('[{}]'));
});
const prices={AAA:[{date:'2026-09-14',close:100},{date:'2026-09-15',close:110}],BBB:[{date:'2026-09-14',close:100},{date:'2026-09-15',close:95}]};
test('60/40 at +10/-5 produces +4% and additive contributions',()=>{
  const r=portfolio.modelPerformance([{symbol:'AAA',weight:60},{symbol:'BBB',weight:40}],0,prices,'1D','2026-09-15');assert.ok(Math.abs(r.returnPercent-4)<1e-10);assert.ok(Math.abs(r.contributions.reduce((n,c)=>n+c.contribution,0)-4)<1e-10);
});
test('buy-and-hold weights drift: 50/50 +100/0 then -50/0 returns 0 total and -33.33 daily',()=>{
  const p={AAA:[{date:'2026-09-14',close:100},{date:'2026-09-15',close:200},{date:'2026-09-16',close:100}],BBB:[{date:'2026-09-14',close:100},{date:'2026-09-15',close:100},{date:'2026-09-16',close:100}]};
  const r=portfolio.modelPerformance([{symbol:'AAA',weight:50},{symbol:'BBB',weight:50}],0,p,'ALL','2026-09-16');assert.equal(r.returnPercent,0);assert.ok(Math.abs(r.dailyPercent+100/3)<1e-10);
});
test('missing prices and invalid weights do not silently reweight or shorten periods',()=>{
  assert.equal(portfolio.modelPerformance([{symbol:'AAA',weight:101}],0,prices,'1D','2026-09-15').reason,'weight_total');
  assert.equal(portfolio.modelPerformance([{symbol:'GONE',weight:100}],0,prices,'1D','2026-09-15').reason,'missing_price');
  assert.equal(portfolio.modelPerformance([{symbol:'AAA',weight:100}],0,prices,'1M','2026-09-15').reason,'insufficient_history');
  assert.equal(portfolio.allocationError([{symbol:'AAA',weight:-1}],101),'invalid_weight');
  const p={...prices,BBB:[{date:'2026-09-14',close:100},{date:'2026-09-16',close:100}],AAA:[...prices.AAA,{date:'2026-09-16',close:100}]};
  assert.equal(portfolio.modelPerformance([{symbol:'AAA',weight:50},{symbol:'BBB',weight:50}],0,p,'ALL','2026-09-16').reason,'history_gap');
});
test('holdings valuation uses prior value denominator and amount entry freezes units',()=>{
  const h=[{symbol:'AAA',quantity:10,averageCost:100,asOf:'2026-09-14'}];
  const s=sigma.buildStockData({...quote,history:[{date:'2026-09-14',close:110},{date:'2026-09-15',close:120}]});
  const r=portfolio.holdingsValuation(h,[s],'2026-09-15');assert.equal(r.value,1200);assert.equal(r.profit,200);assert.equal(r.daily,100);assert.ok(Math.abs(r.dailyPercent-100/11)<1e-10);
  assert.equal(portfolio.quantityFromValue(1200,120),10);assert.equal(portfolio.quantityFromValue(1,0),null);
  assert.equal(portfolio.holdingsValuation([{...h[0],asOf:'2026-09-15'}],[s],'2026-09-15').daily,null);
  assert.equal(portfolio.holdingsValuation(h,[],'2026-09-15').value,null);
});
test('portfolio schema does not accept damage, duplicate symbols or impossible dates',()=>{
  assert.deepEqual(portfolio.parsePortfolio(JSON.stringify(portfolio.EMPTY_PORTFOLIO)),portfolio.EMPTY_PORTFOLIO);
  for(const x of [{version:2},{...portfolio.EMPTY_PORTFOLIO,holdings:[{symbol:'AAA',quantity:1,averageCost:10,asOf:'2026-02-31'}]},{...portfolio.EMPTY_PORTFOLIO,allocations:[{symbol:'AAA',weight:0},{symbol:'AAA',weight:0}]}])assert.throws(()=>portfolio.parsePortfolio(JSON.stringify(x)));
});
test('local document preserves corruption, detects other-tab writes and backs up before saving',()=>{
  const prior=globalThis.localStorage;const map=new Map([['test','broken']]);globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  try{const store=storage.createLocalDocument('test',portfolio.EMPTY_PORTFOLIO,portfolio.parsePortfolio);assert.equal(store.getSnapshot().error,'corrupt');assert.equal(map.get('test'),'broken');map.set('test','newer');assert.equal(store.save(portfolio.EMPTY_PORTFOLIO,'broken'),'conflict');assert.equal(map.get('test'),'newer');assert.equal(store.save(portfolio.EMPTY_PORTFOLIO,'newer'),null);assert.equal(map.get('test:backup'),'newer');}finally{globalThis.localStorage=prior;}
});
test('Friday close is evaluated on the settled band instead of the new zero band',()=>{
  const h={schemaVersion:1,symbol:'AAA',generatedAt:'x',prices:[{date:'2026-09-18',close:120}],bands:[{anchorDate:'2026-09-11',endDate:'2026-09-18',anchor:100,sigmaPercent:10,fromAnchor:true,closes:[{date:'2026-09-18',close:120}]},{anchorDate:'2026-09-18',endDate:'2026-09-25',anchor:120,sigmaPercent:10,closes:[]}]};
  assert.equal(history.historyChartRows(h)[0].sigma,2);assert.equal(history.weeklyOutcomes(h,'2026-09-18')[0].future[0],null);
  assert.equal(dates.bandEndDate('2026-04-02'),'2026-04-10');
});
test('file sharing supports success, no file API, errors and user cancellation',async()=>{
  const blob=new Blob(['png'],{type:'image/png'});
  assert.equal(await sharing.shareImageFile(blob,'NVDA',{canShare:()=>true,share:async()=>{}}),'shared');
  assert.equal(await sharing.shareImageFile(blob,'NVDA',{}),'download');
  assert.equal(await sharing.shareImageFile(blob,'NVDA',{canShare:()=>false,share:async()=>{throw Error();}}),'download');
  assert.equal(await sharing.shareImageFile(blob,'NVDA',{canShare:()=>true,share:async()=>{throw {name:'AbortError'};}}),'cancelled');
  assert.equal(await sharing.shareImageFile(blob,'NVDA',{canShare:()=>true,share:async()=>{throw Error();}}),'download');
});

test('a Thursday holiday close compares against the following Friday, with no look-ahead',()=>{
  const h={schemaVersion:1,symbol:'AAA',generatedAt:'x',prices:[{date:'2026-04-02',close:100},{date:'2026-04-09',close:105},{date:'2026-04-10',close:110}],bands:[{anchorDate:'2026-03-27',endDate:'2026-04-02',anchor:90,sigmaPercent:10,fromAnchor:true,closes:[{date:'2026-04-02',close:100}]}]};
  assert.equal(history.weeklyOutcomes(h,'2026-04-09')[0].future[0],null);
  assert.ok(Math.abs(history.weeklyOutcomes(h,'2026-04-10')[0].future[0]-10)<1e-10);
  const path=history.pricePathAfterClose(h,'2026-04-02',100);
  assert.equal(path[0].returnPercent,0);assert.ok(Math.abs(path.at(-1).returnPercent-10)<1e-10);
});
test('share view model handles missing sigma/GEX, fine prices and long names',()=>{
  const card=load('lib/symbol-card.ts');
  const stock=sigma.buildStockData({...quote,price:0.123456,name:'A company with a very long name '.repeat(5),sigmaPercent:NaN});
  const model=card.symbolCardData(stock,{sessionDate:'2026-09-21',bandAnchorDate:'2026-09-18',bandEndDate:'2026-09-25'},'ko');
  assert.equal(model.support,null);assert.equal(model.resistance,null);assert.equal(model.sigma,'—');assert.equal(model.state,'σ 미제공');
  assert.equal(model.price,'$0.123');assert.equal(model.name,stock.name);
});
test('shared card renderer emits both PNG sizes for missing optional data and a long company name',async()=>{
  const renderer=load('lib/symbol-image.tsx');
  const stock=sigma.buildStockData({...quote,name:'Very long company name '.repeat(8),sigmaPercent:NaN});
  const snapshot={sessionDate:'2026-09-21',bandAnchorDate:'2026-09-18',bandEndDate:'2026-09-25'};
  for(const [feed,width,height] of [[true,1080,1350],[false,1200,630]]) {
    const response=await renderer.renderSymbolImage(stock,snapshot,'ko',feed);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(response.headers.get('content-type'),'image/png');assert.equal(bytes.readUInt32BE(16),width);assert.equal(bytes.readUInt32BE(20),height);
  }
});

test('later IV cannot enter equal-basis summaries or historic weekly event studies',()=>{
  const stock=sigma.buildStockData({...quote,sigmaBasis:{fromAnchor:false,scaled:false}});
  const rows=summary.watchlistRows(['AAA'],[stock],{snapshotId:'one',methodVersion:'v1',priceBasis:'regular',bandAnchorDate:'2026-09-11',bandEndDate:'2026-09-18',sessionDate:'2026-09-18'});
  assert.equal(summary.summarizeWatchlistSigma(rows).comparable,false);
  const h={prices:[{date:'2026-09-18',close:120}],bands:[{anchorDate:'2026-09-11',endDate:'2026-09-18',anchor:100,sigmaPercent:10,fromAnchor:false,closes:[{date:'2026-09-18',close:120}]}]};
  assert.equal(history.historyChartRows(h)[0].sigma,null);assert.deepEqual(history.weeklyOutcomes(h,'2026-09-18'),[]);
});

test('a saved symbol disappearing from the snapshot remains a null observation, not a blocked comparison',()=>{
  const rows=summary.watchlistRows(['GONE'],[],{snapshotId:'new',methodVersion:'v1',priceBasis:'regular',bandAnchorDate:'2026-09-11',bandEndDate:'2026-09-18',sessionDate:'2026-09-18'});
  assert.deepEqual(changes.makeObservation(rows).rows,{GONE:null});
});
test('model uses the reference session calendar to reject jointly missing days',()=>{
  const history={AAA:[{date:'2026-09-14',close:100},{date:'2026-09-16',close:110}],SPY:[{date:'2026-09-14',close:100},{date:'2026-09-15',close:100},{date:'2026-09-16',close:100}]};
  assert.equal(portfolio.modelPerformance([{symbol:'AAA',weight:100}],0,history,'ALL','2026-09-16').reason,'history_gap');
  assert.equal(portfolio.modelPerformance([{symbol:'AAA',weight:100}],0,history,'1D','2026-09-16').reason,'insufficient_history');
});
