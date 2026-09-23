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
const pos=(symbol,quantity,averageCost=null)=>({symbol,quantity,averageCost});
test('sizes worth 60/40 at the start at +10/-5 produce +4% and additive contributions',()=>{
  const r=portfolio.positionsPerformance([pos('AAA',0.6),pos('BBB',0.4)],prices,'1D','2026-09-15');assert.ok(Math.abs(r.returnPercent-4)<1e-10);assert.ok(Math.abs(r.contributions.reduce((n,c)=>n+c.contribution,0)-4)<1e-10);
  const scaled=portfolio.positionsPerformance([pos('AAA',600),pos('BBB',400)],prices,'1D','2026-09-15');assert.ok(Math.abs(scaled.returnPercent-4)<1e-10);
});
test('fixed sizes drift: 50/50 +100/0 then -50/0 returns 0 total and -33.33 daily',()=>{
  const p={AAA:[{date:'2026-09-14',close:100},{date:'2026-09-15',close:200},{date:'2026-09-16',close:100}],BBB:[{date:'2026-09-14',close:100},{date:'2026-09-15',close:100},{date:'2026-09-16',close:100}]};
  const r=portfolio.positionsPerformance([pos('AAA',1),pos('BBB',1)],p,'ALL','2026-09-16');assert.equal(r.returnPercent,0);assert.ok(Math.abs(r.dailyPercent+100/3)<1e-10);
});
test('unsized rows, missing prices and short histories do not silently reweight or shorten periods',()=>{
  assert.equal(portfolio.positionsPerformance([pos('AAA',null)],prices,'1D','2026-09-15').reason,'no_position');
  const missing=portfolio.positionsPerformance([pos('AAA',1),pos('GONE',1)],prices,'1D','2026-09-15');assert.equal(missing.reason,'missing_price');assert.deepEqual(missing.limiting,['GONE']);
  assert.equal(portfolio.positionsPerformance([pos('AAA',1)],prices,'1M','2026-09-15').reason,'insufficient_history');
  const short=portfolio.positionsPerformance([pos('AAA',1),pos('BBB',1)],{AAA:[{date:'2026-09-14',close:100},...prices.AAA],SPY:[{date:'2026-09-14',close:1},{date:'2026-09-15',close:1}],BBB:[{date:'2026-09-15',close:95}]},'1D','2026-09-15');
  assert.equal(short.reason,'insufficient_history');assert.deepEqual(short.limiting,['BBB']);
  const p={...prices,BBB:[{date:'2026-09-14',close:100},{date:'2026-09-16',close:100}],AAA:[...prices.AAA,{date:'2026-09-16',close:100}]};
  const gap=portfolio.positionsPerformance([pos('AAA',1),pos('BBB',1)],p,'ALL','2026-09-16');assert.equal(gap.reason,'history_gap');assert.deepEqual(gap.limiting,['BBB']);
});
test('valuation derives weight, gain and daily change from entered sizes only',()=>{
  const s=sigma.buildStockData({...quote,history:[{date:'2026-09-14',close:110},{date:'2026-09-15',close:120}]});
  const b=sigma.buildStockData({...quote,symbol:'BBB',price:40,previousClose:50});
  const r=portfolio.valuePositions([pos('AAA',10,100),pos('BBB',20),pos('NEW',null)],[s,b],'2026-09-15');
  assert.equal(r.value,2000);assert.equal(r.rows[0].weight,60);assert.equal(r.rows[1].weight,40);assert.equal(r.rows[2].weight,null);
  assert.equal(r.profit,200);assert.equal(r.costCount,1);assert.equal(r.profitPercent,20);
  assert.equal(r.daily,100-200);assert.ok(Math.abs(r.dailyPercent-(-100/2100*100))<1e-10);
  assert.equal(r.sizedCount,2);assert.equal(r.pricedCount,2);
  assert.ok(Math.abs(r.weightedSigma-(0.6*s.zScore+0.4*b.zScore))<1e-10);
  const gone=portfolio.valuePositions([pos('AAA',10),pos('GONE',5)],[s],'2026-09-15');assert.equal(gone.value,1200);assert.equal(gone.rows[0].weight,100);assert.equal(gone.pricedCount,1);assert.equal(gone.sizedCount,2);
  assert.equal(portfolio.valuePositions([pos('AAA',null)],[s],'2026-09-15').value,null);
  assert.equal(portfolio.quantityFromValue(1200,120),10);assert.equal(portfolio.quantityFromValue(1,0),null);
});
test('portfolio schema rejects damage and duplicates, and migrates v1 without inventing sizes',()=>{
  assert.deepEqual(portfolio.parsePortfolio(JSON.stringify(portfolio.EMPTY_PORTFOLIO)),portfolio.EMPTY_PORTFOLIO);
  for(const x of [{version:2},{...portfolio.EMPTY_PORTFOLIO,positions:[pos('AAA',-1)]},{...portfolio.EMPTY_PORTFOLIO,positions:[pos('AAA',1),pos('AAA',2)]},{...portfolio.EMPTY_PORTFOLIO,positions:[pos('aaa',1)]},{...portfolio.EMPTY_PORTFOLIO,positions:Array.from({length:21},(_,i)=>pos(`T${i}`,1))},{version:1,revision:0,allocations:[],cashWeight:100,holdings:[{symbol:'AAA',quantity:1,averageCost:10,asOf:'2026-02-31'}]}])assert.throws(()=>portfolio.parsePortfolio(JSON.stringify(x)));
  const v1={version:1,revision:4,cashWeight:0,allocations:[{symbol:'AAA',weight:60},{symbol:'BBB',weight:40},{symbol:'ZERO',weight:0}],holdings:[{symbol:'AAA',quantity:10,averageCost:100,asOf:'2026-09-14'}]};
  assert.deepEqual(portfolio.parsePortfolio(JSON.stringify(v1)),{version:2,revision:4,positions:[pos('AAA',10,100),pos('BBB',null)]});
  assert.equal(portfolio.isLegacyPortfolio(JSON.stringify(v1)),true);assert.equal(portfolio.isLegacyPortfolio(JSON.stringify(portfolio.EMPTY_PORTFOLIO)),false);assert.equal(portfolio.isLegacyPortfolio('broken'),false);
});
test('loose amount entry reads phone-keyboard input and bulk lines merge into holdings',()=>{
  for(const [text,value] of [['10',10],['1,000',1000],['$180.5',180.5],['10주',10],['.5',0.5],['10.',10],['',null],['0',null]])assert.equal(portfolio.parseAmount(text),value);
  for(const text of ['-1','abc','1.2.3'])assert.equal(portfolio.parseAmount(text),undefined);
  const board=new Set(['NVDA','AAPL','SOXX']);
  const parsed=portfolio.parsePositionLines('nvda 10 180\nAAPL,5\n\nFAKE 1\nSOXX 3 x\nNVDA 12',board);
  assert.deepEqual(parsed.positions,[pos('AAPL',5),pos('NVDA',12)]);assert.deepEqual(parsed.rejected,['FAKE 1','SOXX 3 x']);
  const merged=portfolio.mergePositions([pos('NVDA',1,150)],[pos('NVDA',12),pos('AAPL',5)]);
  assert.deepEqual(merged.positions,[pos('NVDA',12,150),pos('AAPL',5)]);assert.deepEqual(merged.added,['AAPL']);
  const full=portfolio.mergePositions(Array.from({length:20},(_,i)=>pos(`T${i}`,1)),[pos('NEW',1)]);assert.deepEqual(full.skipped,['NEW']);assert.equal(full.positions.length,20);
});
test('local document preserves corruption, detects other-tab writes and backs up before saving',()=>{
  const prior=globalThis.localStorage;const map=new Map([['test','broken']]);globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  try{const store=storage.createLocalDocument('test',portfolio.EMPTY_PORTFOLIO,portfolio.parsePortfolio);assert.equal(store.getSnapshot().error,'corrupt');assert.equal(map.get('test'),'broken');map.set('test','newer');assert.equal(store.save(portfolio.EMPTY_PORTFOLIO,'broken'),'conflict');assert.equal(map.get('test'),'newer');assert.equal(store.save(portfolio.EMPTY_PORTFOLIO,'newer'),null);assert.equal(map.get('test:backup'),'newer');}finally{globalThis.localStorage=prior;}
});
test('local document keeps an edit in memory when the browser refuses storage, and rejects invalid documents',()=>{
  const prior=globalThis.localStorage;const map=new Map();let refuse=false;
  globalThis.localStorage={getItem:k=>{if(refuse)throw new Error('denied');return map.get(k)??null;},setItem:(k,v)=>{if(refuse)throw new Error('denied');map.set(k,v);}};
  try{
    const store=storage.createLocalDocument('memo',portfolio.EMPTY_PORTFOLIO,portfolio.parsePortfolio);store.getSnapshot();
    const doc={...portfolio.EMPTY_PORTFOLIO,revision:1,positions:[pos('AAA',1)]};
    assert.equal(store.save({...doc,positions:[pos('AAA',-1)]},null),'invalid');assert.equal(map.has('memo'),false);
    refuse=true;assert.equal(store.save(doc,null),'storage_unavailable');
    assert.deepEqual(store.getSnapshot().value,doc);assert.equal(store.getSnapshot().persistent,false);assert.equal(map.has('memo'),false);
  }finally{globalThis.localStorage=prior;}
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
  assert.equal(portfolio.positionsPerformance([pos('AAA',1)],history,'ALL','2026-09-16').reason,'history_gap');
  assert.equal(portfolio.positionsPerformance([pos('AAA',1)],history,'1D','2026-09-16').reason,'insufficient_history');
});

test('price/sigma overlay keeps settled Friday, next-week resets and missing bands distinct',()=>{
  const h={prices:[{date:'2026-09-10',close:99},{date:'2026-09-18',close:110},{date:'2026-09-21',close:99}],bands:[
    {anchorDate:'2026-09-11',endDate:'2026-09-18',anchor:100,sigmaPercent:10,fromAnchor:true},
    {anchorDate:'2026-09-18',endDate:'2026-09-25',anchor:110,sigmaPercent:10,fromAnchor:true},
  ]};
  const [missing,friday,monday]=history.historyChartRows(h);
  for(const key of ['sigmaPosition','anchorClose','upper1Sigma','lower1Sigma','range','upperCloseTouchValue','lowerCloseTouchValue'])assert.equal(missing[key],null);
  assert.equal(friday.anchorClose,100);assert.equal(friday.sigmaPosition,1);assert.deepEqual(friday.range,[90,110]);assert.equal(friday.upperCloseTouchValue,110);
  assert.equal(monday.anchorClose,110);assert.equal(monday.sigmaPosition,-1);assert.equal(monday.lowerCloseTouchValue,99);
  assert.notEqual(friday.anchorDate,monday.anchorDate);
});
test('AMD overlay uses the shared unrounded sigma calculation and never rounds touch decisions',()=>{
  const make=close=>history.historyChartRows({prices:[{date:'2026-09-22',close}],bands:[{anchorDate:'2026-09-18',endDate:'2026-09-25',anchor:559.82,sigmaPercent:36.72/559.82*100,fromAnchor:true}]})[0];
  const row=make(623.77);
  assert.ok(Math.abs(row.sigmaPosition-1.741557734204791)<1e-10);
  assert.ok(Math.abs(row.upper1Sigma-596.54)<1e-10);
  assert.ok(Math.abs(row.lower1Sigma-523.10)<1e-10);
  assert.equal(make(596.54-0.00001).upperCloseTouchValue,null);
  assert.equal(row.sigmaPosition,sigma.calculateZScore(623.77,559.82,36.72));
});
test('overlay domains follow the selected period and include outliers without inserting missing sigma',()=>{
  const domains=load('lib/price-sigma-chart.ts').priceSigmaDomains;
  const recent=[{close:100,lower1Sigma:90,upper1Sigma:110,sigmaPosition:0}];
  const prior={close:1000,lower1Sigma:80,upper1Sigma:120,sigmaPosition:45};
  const one=domains(recent),year=domains([prior,...recent]);
  assert.ok(one.price[0]<90 && one.price[1]>110 && one.price[1]<120);
  assert.ok(year.price[1]>1000 && year.sigma[1]>45);
  assert.ok(one.sigma[0]<-1 && one.sigma[1]>1);
  const missing=[{close:100,lower1Sigma:null,upper1Sigma:null,sigmaPosition:null}];
  assert.ok(domains(missing).price[0]>90);assert.equal(missing[0].sigmaPosition,null);
  for(const pair of Object.values(domains([])))assert.ok(pair.every(Number.isFinite) && pair[0]<pair[1]);
});

test('summary All includes every saved symbol, even missing data, and applies both filters to the same rows',()=>{
  const symbols=['UP','DOWN','NEAR','INSIDE','NO_SIGMA','MISSING'];
  const stocks=[['UP',1.1],['DOWN',-1],['NEAR',.85],['INSIDE',.2],['NO_SIGMA',NaN]].map(([symbol,zScore])=>({symbol,zScore}));
  assert.deepEqual(summary.summarySymbolRows(symbols,stocks,'all').map(r=>r.symbol),symbols);
  assert.equal(summary.summarySymbolRows(symbols,stocks,'all').at(-1).stock,null);
  assert.deepEqual(summary.summarySymbolRows(symbols,stocks,'outside').map(r=>r.symbol),['UP','DOWN']);
  assert.deepEqual(summary.summarySymbolRows(symbols,stocks,'approaching').map(r=>r.symbol),['NEAR']);
  assert.deepEqual(summary.summarySymbolRows(['INSIDE'],stocks,'outside'),[]);
});
const proximity=load('lib/gex-proximity.ts');
const level=(strike,netGex=100)=>({strike,netGex});
const gexStock=(support=[],resistance=[],extra={})=>({price:100,gex:{asOf:'2026-09-22',support,resistance,profile:[...support,...resistance],...extra}});
test('GEX proximity includes exact 1%, excludes values beyond it, and picks the closest published candidate per side',()=>{
  const result=proximity.nearbyGexLevels(gexStock([level(98,200),level(99,100)],[level(101,200),level(100.5,100)]),'2026-09-22');
  assert.equal(result.state,'current');assert.equal(result.levels.length,2);
  assert.equal(result.levels.find(r=>r.role==='support').price,99);
  assert.equal(result.levels.find(r=>r.role==='resistance').price,100.5);
  assert.equal(result.levels.find(r=>r.role==='support').distancePercent,-1);
  assert.equal(proximity.nearbyGexLevels(gexStock([],[level(101.00001)]),'2026-09-22').levels.length,0);
  assert.equal(proximity.nearbyGexLevels(gexStock([level(99.999)],[level(100.001)]),'2026-09-22').levels.length,2);
});
test('GEX proximity never invents data or relabels stale, crossed, conflicted or nonpositive candidates',()=>{
  assert.equal(proximity.nearbyGexLevels({price:100},'2026-09-22').state,'unavailable');
  assert.equal(proximity.nearbyGexLevels(gexStock([level(99)],[],{asOf:'2026-09-21'}),'2026-09-22').state,'different_session');
  assert.equal(proximity.nearbyGexLevels(gexStock([level(99)],[],{asOf:'invalid'}),'2026-09-22').state,'unavailable');
  for(const stock of [gexStock([level(100.5)],[level(99.5)]),gexStock([level(100)],[level(100)]),gexStock([level(99,-100)],[level(101,0)])])assert.deepEqual(proximity.nearbyGexLevels(stock,'2026-09-22').levels,[]);
  assert.equal(proximity.nearbyGexLevels({...gexStock([level(99)]),price:0},'2026-09-22').state,'unavailable');
});

test('price history opens at one calendar year and retains the anniversary session',()=>{
  const periods=load('lib/price-sigma-chart.ts');
  assert.equal(periods.DEFAULT_PRICE_SIGMA_PERIOD,'1Y');
  assert.equal(periods.priceSigmaPeriodStart('2026-09-22','1Y'),'2025-09-22');
  assert.equal(periods.priceSigmaPeriodStart('2024-02-29','1Y'),'2023-02-28');
  assert.equal(periods.priceSigmaPeriodStart('2026-03-31','1M'),'2026-02-28');
  assert.equal(periods.priceSigmaPeriodStart('2026-09-22','3M'),'2026-06-22');
  assert.equal(periods.priceSigmaPeriodStart('2026-09-22','ALL'),'');
  const points=[{date:'2025-09-22',close:100},{date:'2026-09-22',close:200}];
  assert.equal(points.filter(p=>p.date>=periods.priceSigmaPeriodStart('2026-09-22','1Y')).length,2);
});
