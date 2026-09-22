"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale } from "@/components/locale-provider";
import { useWatchlist } from "@/hooks/use-watchlist";
import { createLocalDocument } from "@/lib/local-document";
import { EMPTY_PORTFOLIO, PORTFOLIO_KEY, PERIODS, allocationError, holdingsValuation, modelPerformance, parsePortfolio, portfolioHistory, quantityFromValue, type Holding, type PortfolioDocument, type PortfolioPeriod, type PriceHistory } from "@/lib/portfolio";
import { validMarketHistory } from "@/lib/market-history";
import { formatCurrency, formatPercent, formatSigma } from "@/lib/format";
import type { MarketSnapshot, StockData } from "@/lib/types";

const storage = createLocalDocument(PORTFOLIO_KEY, EMPTY_PORTFOLIO, parsePortfolio);
const input = "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-offset-2 focus-visible:outline-ring";
const button = "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm hover:bg-muted/30 disabled:opacity-40";
function download(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content],{type:"application/json"}));
  const a = document.createElement("a"); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function PortfolioDashboard({ stocks, snapshot }: { stocks: StockData[]; snapshot: MarketSnapshot }) {
  const { pick } = useLocale();
  const store = useSyncExternalStore(storage.subscribe,storage.getSnapshot,storage.getServerSnapshot);
  const saved = useWatchlist();
  const [mode,setMode] = useState<"model"|"holdings">("model");
  const [message,setMessage] = useState("");
  const [editorKey,setEditorKey] = useState(0);
  const [imported,setImported] = useState<PortfolioDocument | null>(null);
  function save(doc: PortfolioDocument, replace = false) {
    if (!replace && doc.revision !== store.value.revision) {
      setMessage(pick("다른 탭에서 저장한 값이 있습니다. 현재 입력을 백업하거나 저장된 값을 불러오세요.","Another tab saved changes. Export your draft or load the saved records."));
      return false;
    }
    const error = storage.save({...doc,revision:store.value.revision+1},store.raw);
    setMessage(error ? pick(error === "conflict" ? "다른 탭에서 변경되었습니다. 최신 값을 확인한 뒤 다시 저장하세요." : "저장하지 못했습니다. 브라우저 저장 공간을 확인하고 백업을 내려받으세요.", "Could not save. Check storage access or concurrent edits, then retry.") : pick("이 브라우저에 저장했습니다.", "Saved to this browser."));
    if (!error) setEditorKey(key=>key+1);
    return !error;
  }
  if (!store.ready || !saved.ready) return <p className="py-12 text-sm text-muted-foreground">{pick("포트폴리오를 불러오는 중…","Loading your portfolio…")}</p>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{pick("이 브라우저에만 저장 · USD · 계정 동기화 없음", "Stored on this browser only · USD · no account sync")}</p><div className="flex gap-2">
      <button className={button} onClick={()=>download(store.raw ?? JSON.stringify(store.value,null,2),"my-sigma-portfolio.json")}>{pick("백업 내보내기","Export backup")}</button>
      <label className={`${button} cursor-pointer`}>{pick("가져오기","Import")}<input type="file" accept=".json,application/json" className="sr-only" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw new Error();setImported(parsePortfolio(await file.text()));setMessage("");}catch{setMessage(pick("지원하지 않거나 손상된 백업입니다. 기존 자료는 유지됩니다.","Invalid backup; existing records are preserved."));}e.target.value="";}}/></label>
    </div></div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {imported && <div className="rounded-xl border border-border p-4"><p className="text-sm">{pick(`비중 ${imported.allocations.length}개 · 보유 ${imported.holdings.length}개로 교체합니다. 기존 자료는 자동 백업합니다.`,`Replace with ${imported.allocations.length} allocations and ${imported.holdings.length} holdings. Existing records will be backed up.`)}</p><div className="mt-3 flex gap-2"><button className={button} onClick={()=>{if(save(imported,true))setImported(null);}}>{pick("백업 적용","Apply backup")}</button><button className={button} onClick={()=>setImported(null)}>{pick("취소","Cancel")}</button></div></div>}
    {store.error ? <div role="alert" className="rounded-xl border border-border p-5"><p>{pick("저장된 자료를 읽을 수 없습니다. 원본을 내보내거나 정상 백업을 가져오세요.","Stored data could not be read. Export the original or import a valid backup.")}</p></div> : <PortfolioEditor mode={mode} setMode={setMode} key={editorKey} onReload={()=>setEditorKey(key=>key+1)} initial={store.value} symbols={saved.symbols} stocks={stocks} snapshot={snapshot} onSave={save}/>}
  </div>;
}

function PortfolioEditor({ initial, symbols, stocks, snapshot, onSave, mode, setMode, onReload }: { onReload: ()=>void; mode: "model"|"holdings"; setMode: (mode:"model"|"holdings")=>void; initial: PortfolioDocument; symbols: string[]; stocks: StockData[]; snapshot: MarketSnapshot; onSave: (doc: PortfolioDocument)=>boolean }) {
  const { pick } = useLocale();
  const [doc,setDoc] = useState(initial);
  const [period,setPeriod] = useState<PortfolioPeriod>("1W");
  const [investment,setInvestment] = useState(10000);
  const [benchmark,setBenchmark] = useState("SPY");
  const [addSymbol,setAddSymbol] = useState("");
  const [history,setHistory] = useState<PriceHistory>({});
  const [edit,setEdit] = useState<Holding | null>(null);
  const [formError,setFormError] = useState("");
  const base = useMemo(()=>portfolioHistory(stocks),[stocks]);
  const symbolsKey = [...new Set([...doc.allocations.filter(r=>r.weight>0).map(r=>r.symbol),benchmark])].filter(Boolean).sort().join(",");
  useEffect(()=>{
    const controller=new AbortController();
    Promise.all(symbolsKey.split(",").filter(Boolean).map(async symbol=>{
      try{const res=await fetch(`/api/history/${encodeURIComponent(symbol)}`,{signal:controller.signal});if(!res.ok)return null;const data:unknown=await res.json();return validMarketHistory(data,symbol)?[symbol,data.prices] as const:null;}catch{return null;}
    })).then(values=>{if(!controller.signal.aborted)setHistory(Object.fromEntries(values.filter(v=>v!==null)));});
    return()=>controller.abort();
  },[symbolsKey]);
  const prices={...base,...history};
  const performance=modelPerformance(doc.allocations,doc.cashWeight,prices,period,snapshot.sessionDate);
  const comparison=benchmark?modelPerformance([{symbol:benchmark,weight:100}],0,prices,period,snapshot.sessionDate):null;
  const matching=comparison?.start===performance.start?comparison:null;
  const comparisonMap=new Map(matching?.points.map(p=>[p.date,p.returnPercent]));
  const chart=performance.points.map(p=>({...p,benchmark:comparisonMap.get(p.date)}));
  const valuation=holdingsValuation(doc.holdings,stocks,snapshot.sessionDate);
  const bySymbol=new Map(stocks.map(s=>[s.symbol,s]));
  const total=doc.allocations.reduce((sum,r)=>sum+r.weight,doc.cashWeight);
  const dirty=JSON.stringify(doc)!==JSON.stringify(initial);
  const error=allocationError(doc.allocations,doc.cashWeight);
  const eligible=symbols.filter(s=>!doc.allocations.some(r=>r.symbol===s));
  const money=(value:number|null)=>value===null?"—":formatCurrency(value);
  const reason=performance.reason==="no_allocation"?pick("관심종목에서 종목을 추가하고 비중을 입력하세요.","Add saved symbols and set their weights."):performance.reason==="weight_total"?pick("현금을 포함한 비중 합계를 100%로 맞추세요.","Weights including cash must total 100%."):pick("이 기간의 공통 가격 자료가 부족합니다. 짧은 기간을 선택하세요.","Not enough common price history. Choose a shorter period.");
  return <>
    <div className="flex flex-wrap gap-2">{(["model","holdings"] as const).map(key=><button key={key} onClick={()=>setMode(key)} aria-pressed={mode===key} className={`${button} ${mode===key?"bg-foreground text-background":"text-muted-foreground"}`}>{key==="model"?pick("비중 시뮬레이션","Allocation model"):pick("보유 관리","Holdings")}</button>)}<button disabled={!dirty||!!error} onClick={()=>onSave(doc)} className={`${button} ml-auto bg-primary text-primary-foreground`}>{pick("변경 저장","Save changes")}{dirty?" ·":""}</button></div>
    {doc.revision!==initial.revision&&<div role="alert" className="rounded-xl border border-border p-4 text-sm"><p>{pick("다른 탭에서 변경되었습니다. 현재 입력을 보존한 채 자동 저장을 중단했습니다.","Another tab changed this portfolio. Your draft is preserved and saving is paused.")}</p><div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={()=>download(JSON.stringify(doc,null,2),"my-sigma-draft.json")}>{pick("현재 입력 내보내기","Export draft")}</button><button className={button} onClick={()=>{if(!dirty||window.confirm(pick("현재 입력을 취소하고 저장된 값을 불러올까요?","Discard this draft and load the saved records?")))onReload();}}>{pick("저장된 값 불러오기","Load saved records")}</button></div></div>}
    {dirty&&<p className="text-xs text-muted-foreground">{pick("아직 저장하지 않은 변경사항이 있습니다.","You have unsaved changes.")}</p>}
    {mode==="model"?<>
      <div className="glass rounded-2xl p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{pick("모형 가격수익률","Model price return")}</p><p className="num mt-2 text-4xl font-semibold tracking-tight">{performance.returnPercent===null?"—":formatPercent(performance.returnPercent)}</p><p className="mt-2 text-xs text-muted-foreground">{performance.start??"—"} → {snapshot.sessionDate}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">{pick("모형 일간 변화","Model daily change")}</p><p className="num mt-1 text-lg">{performance.dailyPercent===null?"—":formatPercent(performance.dailyPercent)}</p><p className="num mt-2 text-sm text-muted-foreground">{performance.returnPercent===null?"—":formatCurrency(investment*(1+performance.returnPercent/100))}</p></div></div>
      <div className="mt-5 flex flex-wrap items-center gap-1">{PERIODS.map(p=><button key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)} className={`min-h-11 rounded-lg px-3 text-xs ${period===p?"bg-foreground text-background":"text-muted-foreground"}`}>{p}</button>)}<label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">{pick("비교","Compare")}<select className="min-h-11 rounded-lg border border-border bg-background px-2 text-sm" value={benchmark} onChange={e=>setBenchmark(e.target.value)}><option value="">{pick("없음","None")}</option><option>SPY</option><option>QQQ</option></select></label></div>
      {chart.length>1?<div className="mt-4 h-64 min-w-0 sm:h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{top:8,right:10,left:0,bottom:0}}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5}/><XAxis dataKey="date" tickFormatter={v=>String(v).slice(5)} minTickGap={50} tick={{fontSize:12,fill:"var(--muted-foreground)"}}/><YAxis width={52} tickFormatter={v=>`${Number(v).toFixed(1)}%`} tick={{fontSize:12,fill:"var(--muted-foreground)"}}/><ReferenceLine y={0} stroke="var(--border)"/><Tooltip formatter={(v,name)=>[formatPercent(Number(v)),name]} contentStyle={{background:"var(--background)",border:"1px solid var(--border)",borderRadius:12,color:"var(--foreground)"}}/><Line type="linear" dataKey="returnPercent" name={pick("포트폴리오","Portfolio")} stroke="var(--primary)" strokeWidth={2.5} dot={false} isAnimationActive={false}/>{matching&&<Line dataKey="benchmark" name={benchmark} stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={false} isAnimationActive={false}/>}</LineChart></ResponsiveContainer></div>:<p role="status" className="flex min-h-48 items-center justify-center px-4 text-center text-sm text-muted-foreground">{reason}</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{pick("기간 시작 비중으로 매수 후 보유 · 리밸런싱 없음 · 현금 이자 0 · 배당·환율·비용 미반영. 실제 계좌 수익률이 아닙니다.","Buy and hold at starting weights · no rebalancing · zero cash interest · excludes dividends, FX and costs. Not an actual account return.")}</p></div>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{pick("시작 비중","Starting allocation")}</h2><p className={`num mt-1 text-sm ${error?"text-down":"text-muted-foreground"}`}>{pick("합계","Total")} {total.toFixed(2)}% / 100%</p></div><label className="text-xs text-muted-foreground">{pick("가상 투자금 ($)","Model investment ($)")}<input className={`${input} mt-1 max-w-40`} type="number" min="1" value={investment} onChange={e=>setInvestment(Math.max(1,Number(e.target.value)))}/></label></div>
      <div className="divide-y divide-border rounded-2xl border border-border">{doc.allocations.map((row,i)=>{const contribution=performance.contributions.find(c=>c.symbol===row.symbol);return <div key={row.symbol} className="flex flex-wrap items-center gap-3 p-4"><Link href={`/symbol/${row.symbol}`} className="w-16 text-sm font-semibold">{row.symbol}</Link><span className="num mr-auto text-xs text-muted-foreground">{formatSigma(bySymbol.get(row.symbol)?.zScore??NaN)}</span><label className="flex items-center gap-1"><input aria-label={`${row.symbol} ${pick("시작 비중","starting weight")}`} className={`${input} max-w-24 num text-right`} type="number" min="0" max="100" step="0.1" value={row.weight} onChange={e=>setDoc({...doc,allocations:doc.allocations.map((r,j)=>i===j?{...r,weight:Number(e.target.value)}:r)})}/><span className="text-xs">%</span></label><button className="min-h-11 px-2 text-xs text-muted-foreground" onClick={()=>setDoc({...doc,allocations:doc.allocations.filter(r=>r.symbol!==row.symbol)})}>{pick("제외","Remove")}</button><p className="w-full text-xs text-muted-foreground">{pick("수익 기여","Contribution")} {contribution?`${contribution.contribution.toFixed(2)}%p`:"—"} · {pick("기말 비중","Ending weight")} {contribution?`${contribution.endWeight.toFixed(2)}%`:"—"}</p></div>;})}<div className="flex items-center justify-between gap-3 p-4"><span className="text-sm">{pick("현금","Cash")}</span><label className="flex items-center gap-1"><input aria-label={pick("현금 비중","Cash weight")} className={`${input} max-w-24 num text-right`} type="number" min="0" max="100" step="0.1" value={doc.cashWeight} onChange={e=>setDoc({...doc,cashWeight:Number(e.target.value)})}/><span className="text-xs">%</span></label></div></div>
      <div className="flex flex-wrap gap-2"><select aria-label={pick("관심종목에서 추가","Add from watchlist")} className={`${input} max-w-64`} value={addSymbol} onChange={e=>setAddSymbol(e.target.value)}><option value="">{pick("관심종목에서 선택","Choose a saved symbol")}</option>{eligible.map(s=><option key={s}>{s}</option>)}</select><button disabled={!addSymbol||doc.allocations.length>=20} className={button} onClick={()=>{setDoc({...doc,allocations:[...doc.allocations,{symbol:addSymbol,weight:0}]});setAddSymbol("");}}>{pick("추가","Add")}</button>{symbols.length===0&&<Link href="/my-sigma#symbol-search" className={button}>{pick("관심종목 저장하기","Save symbols first")}</Link>}</div>
    </>:<>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[[pick("평가금액","Market value"),money(valuation.value)],[pick("미실현 손익","Unrealized gain"),money(valuation.profit)],[pick("원가 대비","On cost"),valuation.returnPercent===null?"—":formatPercent(valuation.returnPercent)],[pick("일간 손익 · 수량 고정","Daily gain · fixed units"),(valuation.dailyPercent===null?"—":formatPercent(valuation.dailyPercent))+" · "+money(valuation.daily)]].map(([label,value])=><div key={label} className="glass rounded-2xl p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="num mt-2 break-all text-xl font-semibold">{value}</p></div>)}</div>
      <p className="text-xs leading-relaxed text-muted-foreground">{snapshot.sessionDate} {pick("종가 기준 · USD. 일간 변화는 등록 기준일부터 같은 수량을 보유한 가정입니다. 매매·배당·입출금·환율·비용을 반영한 계좌 성과는 제공하지 않습니다.","close · USD. Daily change assumes unchanged units since the recorded date. This is not account performance including trades, income, cash flows, FX or costs.")}</p>
      <div className="divide-y divide-border rounded-2xl border border-border">{valuation.rows.map(h=><div key={h.symbol} className="p-4"><div className="flex items-center justify-between gap-3"><Link href={`/symbol/${h.symbol}`} className="font-semibold">{h.symbol}</Link><span className="num ml-auto">{money(h.value)}</span><button className={button} onClick={()=>setEdit(h)}>{pick("수정","Edit")}</button></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4"><p>{pick("수량","Units")} <span className="num">{h.quantity.toLocaleString(undefined,{maximumFractionDigits:6})}</span></p><p>{pick("평단","Average cost")} {formatCurrency(h.averageCost)}</p><p>{pick("실제 비중","Current weight")} {valuation.value&&h.value!==null?`${(h.value/valuation.value*100).toFixed(1)}%`:"—"}</p><p>{pick("손익","Gain")} {money(h.profit)}</p></div></div>)}</div>
      {!doc.holdings.length&&<p className="py-6 text-sm text-muted-foreground">{pick("관심종목의 수량과 평단을 입력해 보유 손익을 확인하세요.","Add units and average cost to see holding gains.")}</p>}
      <button className={button} disabled={doc.holdings.length>=20} onClick={()=>setEdit({symbol:symbols.find(s=>!doc.holdings.some(h=>h.symbol===s))??"",quantity:0,averageCost:0,asOf:snapshot.sessionDate})}>{pick("보유 종목 추가","Add holding")}</button>
      {edit&&<HoldingForm key={`${edit.symbol}-${edit.asOf}`} holding={edit} symbols={[...new Set([...symbols,...doc.holdings.map(h=>h.symbol)])]} stocks={stocks} latest={snapshot.sessionDate} onCancel={()=>setEdit(null)} onSave={h=>{const duplicate=doc.holdings.some(r=>r.symbol===h.symbol&&r.symbol!==edit.symbol);if(duplicate){setFormError(pick("이미 등록된 종목입니다.","This holding already exists."));return;}setDoc({...doc,holdings:[...doc.holdings.filter(r=>r.symbol!==edit.symbol),h]});setEdit(null);setFormError("");}} onRemove={()=>{setDoc({...doc,holdings:doc.holdings.filter(r=>r.symbol!==edit.symbol)});setEdit(null);}}/>}
      {formError&&<p role="alert" className="text-sm text-down">{formError}</p>}
    </>}
  </>;
}
function HoldingForm({holding,symbols,stocks,latest,onSave,onCancel,onRemove}:{holding:Holding;symbols:string[];stocks:StockData[];latest:string;onSave:(h:Holding)=>void;onCancel:()=>void;onRemove:()=>void}) {
  const {pick}=useLocale();
  const [symbol,setSymbol]=useState(holding.symbol);
  const [kind,setKind]=useState("units");
  const [amount,setAmount]=useState(holding.quantity?String(holding.quantity):"");
  const [cost,setCost]=useState(holding.averageCost?String(holding.averageCost):"");
  const [date,setDate]=useState(holding.asOf);
  const [error,setError]=useState("");
  const price=stocks.find(s=>s.symbol===symbol)?.price??NaN;
  return <form className="glass space-y-4 rounded-2xl p-5" onSubmit={e=>{e.preventDefault();const quantity=kind==="value"?quantityFromValue(Number(amount),price):Number(amount);if(!symbol||!quantity||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(Number(cost))||Number(cost)<=0||!date||date>latest){setError(pick("종목·양수 수량·평단·기준일을 확인하세요.","Check symbol, positive units and cost, and date."));return;}onSave({symbol,quantity,averageCost:Number(cost),asOf:date});}}>
    <h3 className="font-semibold">{pick("보유정보 입력","Holding details")}</h3><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">{pick("종목","Symbol")}<select className={`${input} mt-1`} value={symbol} onChange={e=>setSymbol(e.target.value)}><option value="">{pick("선택","Choose")}</option>{symbols.map(s=><option key={s}>{s}</option>)}</select></label><label className="text-sm">{pick("보유 기준일","Held since")}<input className={`${input} mt-1`} type="date" value={date} max={latest} onChange={e=>setDate(e.target.value)}/></label><label className="text-sm"><select aria-label={pick("입력 방식","Input basis")} className="mb-1 bg-background" value={kind} onChange={e=>{setKind(e.target.value);setAmount("");}}><option value="units">{pick("보유 수량","Units")}</option><option value="value">{pick("현재 평가금액 ($)","Current market value ($)")}</option></select><input aria-label={kind==="value"?pick("현재 평가금액 ($)","Current market value ($)"):pick("보유 수량","Units")} required className={input} type="number" min="0.00000001" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="text-sm">{pick("평균 매입단가 ($)","Average cost per share ($)")}<input required className={`${input} mt-1`} type="number" min="0.00000001" step="any" value={cost} onChange={e=>setCost(e.target.value)}/></label></div>
    {kind==="value"&&<p className="text-xs text-muted-foreground">{pick(`${latest} 종가 ${formatCurrency(price)}로 수량을 환산해 고정합니다.`, `Converts to fixed units at the ${latest} close of ${formatCurrency(price)}.`)}</p>}
    {error&&<p role="alert" className="text-sm text-down">{error}</p>}<div className="flex flex-wrap gap-2"><button className={`${button} bg-foreground text-background`}>{pick("입력 적용","Apply")}</button><button type="button" className={button} onClick={onCancel}>{pick("취소","Cancel")}</button>{holding.quantity>0&&<button type="button" className={`${button} ml-auto`} onClick={()=>{if(window.confirm(pick("이 보유정보를 제거할까요? 저장 시 이전 자료를 백업합니다.","Remove this holding? Saving backs up the previous records.")))onRemove();}}>{pick("보유정보 제거","Remove holding")}</button>}</div>
  </form>;
}
