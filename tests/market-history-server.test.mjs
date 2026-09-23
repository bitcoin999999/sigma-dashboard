import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url),modules=new Map();
function load(file){file=resolve(root,file);if(modules.has(file))return modules.get(file).exports;const mod={exports:{}};modules.set(file,mod);
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(id=>id==='server-only'?{}:id.startsWith('.')?load(resolve(dirname(file),`${id}.ts`)):require(id),mod,mod.exports);return mod.exports;}
const {loadMarketHistory}=load('lib/market-history-server.ts');
const stock={symbol:'NVDA',anchor:100,sigmaPercent:5,sigmaBasis:{fromAnchor:true},history:[{date:'2026-09-22',close:102}]};
const snapshot={generatedAt:'2026-09-23T05:42:33+09:00',bandAnchorDate:'2026-09-18',bandEndDate:'2026-09-25',sessionDate:'2026-09-22'};
const archive={schemaVersion:1,symbol:'NVDA',generatedAt:snapshot.generatedAt,prices:[{date:'2025-09-22',close:90},...stock.history],bands:[]};
function mock(t,fn){const old=process.env.SNAPSHOT_URL,fetch=global.fetch;process.env.SNAPSHOT_URL='https://data.example/snapshot/latest.json';global.fetch=fn;t.after(()=>{global.fetch=fetch;if(old===undefined)delete process.env.SNAPSHOT_URL;else process.env.SNAPSHOT_URL=old;});}
test('first visit reads the current archive without a stale per-symbol cache',async t=>{
 let calls=0;mock(t,async (url,options)=>{calls++;assert.equal(String(url),'https://data.example/snapshot/history/NVDA.json');assert.equal(options.cache,'no-store');assert.equal(options.next,undefined);return Response.json(archive);});
 const h=await loadMarketHistory(stock,snapshot);assert.equal(calls,1);assert.equal(h.prices[0].date,'2025-09-22');assert.equal(h.archiveUnavailable,undefined);
});
test('temporary archive failure retries and retains the long history',async t=>{
 let calls=0;mock(t,async()=>++calls===1?new Response('',{status:503}):Response.json(archive));
 const h=await loadMarketHistory(stock,snapshot);assert.equal(calls,2);assert.equal(h.prices.length,2);assert.equal(h.archiveUnavailable,undefined);
});
test('an invalid or wrong-symbol response is never treated as a valid archive',async t=>{
 let calls=0;mock(t,async()=>++calls===1?Response.json({...archive,symbol:'AMD'}):Response.json(archive));
 const h=await loadMarketHistory(stock,snapshot);assert.equal(calls,2);assert.equal(h.symbol,'NVDA');assert.equal(h.prices.length,2);
});
test('persistent failures explicitly mark the recent-only fallback for the UI',async t=>{
 let calls=0;mock(t,async()=>{calls++;throw new Error('timeout');});
 const h=await loadMarketHistory(stock,snapshot);assert.equal(calls,2);assert.equal(h.archiveUnavailable,true);assert.deepEqual(h.prices,stock.history);
});
