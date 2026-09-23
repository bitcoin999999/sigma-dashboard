"use client";
import { useState } from "react";
import { ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale } from "@/components/locale-provider";
import { historyChartRows, weeklyOutcomes, pricePathAfterClose, type MarketHistory } from "@/lib/market-history";
import { formatPercent, formatSigma } from "@/lib/format";
import { PriceSigmaOverlayChart } from "./price-sigma-overlay-chart";
import { isOutsideSigma } from "@/lib/sigma";

export function SigmaHistoryChart({ history, session }: { history: MarketHistory; session: string }) {
  const { pick } = useLocale();
  const [selected,setSelected] = useState<string | null>(null);
  const [weeks,setWeeks] = useState(13);
  const [side,setSide] = useState<"all"|"upper"|"lower">("all");
  const end = new Date(`${session}T00:00:00Z`); end.setUTCDate(end.getUTCDate()-weeks*7);
  const start = end.toISOString().slice(0,10);
  const rows = historyChartRows(history).filter(r => r.date >= start && r.date <= session);
  const outcomes = weeklyOutcomes(history,session).filter(r => r.closeDate >= start && (side === "all" || (isOutsideSigma(r.closeZ) && (side === "upper" ? r.closeZ > 0 : r.closeZ < 0))));
  const tooltip = { backgroundColor: "var(--background)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)", fontSize: 13 };
  const dateTick = (value: string) => value.slice(5).replace("-","/");
  const event = outcomes.find(r=>r.closeDate===selected) ?? outcomes[0];
  const path = event ? pricePathAfterClose(history,event.closeDate,event.close) : [];
  return <section className="glass mt-8 min-w-0 rounded-2xl p-4 sm:p-6" aria-label={pick("주가와 주간 시그마 이력", "Price and weekly sigma history")}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{history.symbol} · {pick("주가와 주간 σ", "Price & weekly sigma")}</h2><p className="mt-1 text-xs text-muted-foreground">{pick("각 날짜에 적용된 밴드 기준 · 주간 마감 후에도 과거 밴드 유지", "Each date uses its own weekly band · settled bands are retained")}</p></div>
      <div className="flex gap-1">{[[4,"1M"],[13,"3M"],[52,"1Y"],[520,"ALL"]].map(([n,label]) => <button key={label} aria-pressed={weeks === n} onClick={() => setWeeks(Number(n))} className={`min-h-11 rounded-lg px-3 text-sm ${weeks === n ? "bg-foreground text-background" : "text-muted-foreground"}`}>{label}</button>)}</div></div>
    <PriceSigmaOverlayChart data={rows} symbol={history.symbol} />
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{pick(`확보된 가격: ${history.prices[0]?.date ?? "—"}–${session}. 당시 밴드가 없거나 주중 IV로 설정된 구간은 σ를 비워 둡니다.`, `Available prices: ${history.prices[0]?.date ?? "—"}–${session}. Sigma is blank where the historic band is unavailable or was set with later IV.`)}</p>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{pick("주간 마감 이후 가격 변화", "Price after the weekly close")}</h3><div className="flex gap-1">{(["all","upper","lower"] as const).map(key=><button key={key} aria-pressed={side===key} onClick={()=>{setSide(key);setSelected(null);}} className={`min-h-11 rounded-lg px-3 text-xs ${side===key?"bg-foreground text-background":"text-muted-foreground"}`}>{key==="all"?pick("전체","All"):key==="upper"?"≥ +1σ":"≤ −1σ"}</button>)}</div></div>
    <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs sm:text-sm"><thead className="text-muted-foreground"><tr>{[pick("마감일","Close date"),pick("당시 σ","Sigma"),"+1W","+2W","+4W"].map(h=><th key={h} className="whitespace-nowrap py-3 pr-3 font-normal">{h}</th>)}</tr></thead><tbody>{outcomes.slice(0,12).map(r=><tr key={r.anchorDate} className="num border-t border-border/50"><td className="whitespace-nowrap py-3 pr-3"><button className="min-h-11 underline decoration-border underline-offset-4" aria-pressed={event?.closeDate===r.closeDate} onClick={()=>setSelected(r.closeDate)}>{r.closeDate}</button></td><td className="pr-3">{formatSigma(r.closeZ)}</td>{r.future.map((v,i)=><td key={i} className="pr-3">{v === null?"—":formatPercent(v)}</td>)}</tr>)}</tbody></table></div>
    {event&&path.length>1&&<div className="mt-4 rounded-xl border border-border p-3 sm:p-4">
      <p className="text-sm font-medium">{event.closeDate} · {formatSigma(event.closeZ)} {pick("마감 이후", "after the close")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{pick("선택한 마감가 = 0% · 최대 4주 · 표의 날짜를 눌러 비교", "Selected close = 0% · up to 4 weeks · select a date above")}</p>
      <div className="mt-3 h-44 min-w-0 overflow-hidden"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={path} margin={{top:8,right:8,bottom:0,left:0}}>
        <XAxis dataKey="date" tickFormatter={dateTick} minTickGap={48} tick={{fontSize:12,fill:"var(--muted-foreground)"}}/>
        <YAxis width={58} tickFormatter={v=>`${Number(v).toFixed(1)}%`} tick={{fontSize:12,fill:"var(--muted-foreground)"}}/>
        <ReferenceLine y={0} stroke="var(--border)"/>
        <Tooltip contentStyle={tooltip} formatter={v=>[formatPercent(Number(v)),pick("마감 후 변화","Change since close")]}/>
        <Line dataKey="returnPercent" stroke="var(--primary)" strokeWidth={2} dot={{r:2}} isAnimationActive={false}/>
      </ComposedChart></ResponsiveContainer></div>
    </div>}
    {!outcomes.length && <p className="py-4 text-sm text-muted-foreground">{pick("이 조건의 완료 주 데이터가 없습니다.", "No settled weeks for this selection.")}</p>}
    <p className="mt-3 text-xs text-muted-foreground">{pick("종가 간 가격 변화이며 배당·비용 미반영. —는 아직 도래하지 않았거나 자료가 없는 기간입니다. 예측력은 미검증입니다.", "Close-to-close price changes, excluding dividends and costs. — means future or unavailable. Predictive value is unverified.")}</p>
  </section>;
}
