import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function compile(path, resolve = require) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const result = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolve, result, result.exports);
  return result.exports;
}
const watch = compile('../lib/watchlist.ts');
const sharing = compile('../lib/share.ts');
const navigation = compile('../lib/stock-navigation.ts');
test('legacy watchlist keeps valid saved names, deduplicates, preserves unavailable names, and caps at twenty', () => {
  assert.equal(watch.WATCHLIST_KEY, 'sigma-personal-watchlist');
  assert.deepEqual(watch.parseStoredSymbols('["nvda"," NVDA ","OLD",null,5,"<script>"]'), ['NVDA','OLD']);
  assert.deepEqual(watch.normalizeSymbols(['NVDA','OLD'],new Set(['NVDA'])), ['NVDA']);
  assert.deepEqual(watch.parseStoredSymbols('broken'), []);
  const ten=Array.from({length:20},(_,i)=>`T${i}`);
  assert.deepEqual(watch.toggleSymbol(ten,'NEW'),ten);
  assert.deepEqual(watch.toggleSymbol(['AAPL','NVDA'],'MSFT'),['AAPL','NVDA','MSFT']);
  assert.deepEqual(watch.toggleSymbol(['AAPL','NVDA'],'NVDA'),['AAPL']);
});
test('all watch consumers share writes; storage denial is explicit and cross-tab changes propagate', () => {
  const saved = new Map([['sigma-personal-watchlist','["AAPL"]']]);
  const events = new Map(); let deny=false;
  const oldStorage=globalThis.localStorage, oldWindow=globalThis.window;
  globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>{if(deny)throw new Error('quota');saved.set(key,value)}};
  globalThis.window={addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:()=>{}};
  let subscriptions=0;
  try {
    const store=compile('../hooks/use-watchlist.ts',id=>id==='react'?{useSyncExternalStore:(subscribe,read)=>{subscribe(()=>subscriptions++);return read();}}:id==='@/lib/watchlist'?watch:require(id));
    assert.deepEqual(store.useWatchlist().symbols,['AAPL']);
    store.toggleWatchlist('NVDA');
    assert.deepEqual(store.useWatchlist().symbols,['AAPL','NVDA']);
    deny=true; store.toggleWatchlist('MSFT');
    assert.equal(store.useWatchlist().persistent,false);
    assert.deepEqual(store.useWatchlist().symbols,['AAPL','NVDA','MSFT']);
    saved.set(watch.WATCHLIST_KEY,'["TSLA"]');events.get('storage')({key:watch.WATCHLIST_KEY});
    assert.deepEqual(store.useWatchlist().symbols,['TSLA']);assert.ok(subscriptions>0);
  } finally {globalThis.localStorage=oldStorage;globalThis.window=oldWindow;}
});
test('native share cancellation never copies or reports an error; failed/unsupported share falls back',async()=>{
  const input={title:'NVDA',text:'Latest data',url:'https://example.test/symbol/NVDA'};
  let copies=0;
  const clipboard={writeText:async text=>{assert.equal(text,input.url);copies++}};
  assert.equal(await sharing.shareLink(input,{share:async()=>{throw {name:'AbortError'}},clipboard}),'cancelled');
  assert.equal(copies,0);
  assert.equal(await sharing.shareLink(input,{share:async()=>{},clipboard}),'shared');
  assert.equal(copies,0);
  assert.equal(await sharing.shareLink(input,{share:async()=>{throw new Error('unsupported')},clipboard}),'copied');
  assert.equal(await sharing.shareLink(input,{clipboard}),'copied');
  assert.equal(copies,2);
  assert.equal(await sharing.copyLink(input.url,{}),'manual');
  assert.equal(await sharing.copyLink(input.url,{clipboard:{writeText:async()=>{throw new Error('denied')}}}),'manual');
});
test('mobile links and modified desktop clicks navigate; only plain desktop clicks open panels',()=>{
  const click={button:0,metaKey:false,ctrlKey:false,altKey:false,shiftKey:false};
  assert.equal(navigation.opensPanel(click,false),false);
  assert.equal(navigation.opensPanel(click,true),true);
  for(const key of ['metaKey','ctrlKey','shiftKey','altKey'])assert.equal(navigation.opensPanel({...click,[key]:true},true),false);
  assert.equal(navigation.opensPanel({...click,button:1},true),false);
});
