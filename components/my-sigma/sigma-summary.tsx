"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { summarizeWatchlistSigma, watchlistRows, attentionStocks } from "@/lib/watchlist-summary";
import { formatSigma } from "@/lib/format";
import { isApproachingSigma, isOutsideSigma } from "@/lib/sigma";
import { productEvent } from "@/lib/product-events";
import type { MarketSnapshot, StockData } from "@/lib/types";

export type SigmaFilter = "all" | "outside" | "approaching";
export function matchesSigmaFilter(stock: StockData, filter: SigmaFilter) {
  return filter === "all" || (filter === "outside" ? isOutsideSigma(stock.zScore) : isApproachingSigma(stock.zScore));
}
export function SigmaSummary({ symbols, stocks, snapshot, compact = false, filter = "all", onFilter }: {
  symbols: string[]; stocks: StockData[]; snapshot: MarketSnapshot; compact?: boolean; filter?: SigmaFilter; onFilter?: (filter: SigmaFilter) => void;
}) {
  const { pick } = useLocale();
  const summary = summarizeWatchlistSigma(watchlistRows(symbols, stocks, snapshot));
  const selected = stocks.filter(s => symbols.includes(s.symbol));
  const surface = compact ? "home" : "my_sigma";
  useEffect(() => {
    if (summary.totalCount) productEvent("my_sigma_summary_view", surface, { symbolCount: summary.totalCount, validCount: summary.validCount, ...(summary.outsideCount === null ? {} : { outsideCount: summary.outsideCount }) });
  }, [surface, summary.totalCount, summary.validCount, summary.outsideCount, snapshot.snapshotId]);
  if (!symbols.length) return <div className="rounded-2xl border border-dashed border-border p-6">
    <p className="font-medium">{pick("아직 요약할 종목이 없습니다.", "No symbols to summarize yet.")}</p>
    <p className="mt-2 text-sm text-muted-foreground">{pick("관심종목을 저장하면 평균 위치와 경계 밖 종목을 확인할 수 있습니다.", "Save symbols to see their average position and moves outside the band.")}</p>
    <a href={compact ? "/my-sigma#symbol-search" : "#symbol-search"} className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">{pick("종목 검색", "Find symbols")}</a>
  </div>;
  const values = [
    [pick("평균 위치", "Mean position"), summary.meanSigma === null ? "—" : formatSigma(summary.meanSigma)],
    [pick("평균 절대 위치", "Mean absolute position"), summary.meanAbsoluteSigma === null ? "—" : `${summary.meanAbsoluteSigma.toFixed(2)}σ`],
    [pick("±1σ 경계 밖", "At / outside ±1σ"), summary.outsideCount === null ? "—" : `${summary.outsideCount} / ${summary.totalCount}`],
    [pick("분석 가능", "Available"), `${summary.validCount} / ${summary.totalCount}`],
  ];
  return <section aria-label={pick("My Sigma 요약", "My Sigma summary")} className="glass overflow-hidden rounded-2xl">
    <div className="grid grid-cols-2 divide-border sm:grid-cols-4">{values.map(([label,value]) => <div key={label} className="border-b border-border/50 px-4 py-5 sm:px-5"><p className="text-xs text-muted-foreground">{label}</p><p className="num mt-2 text-2xl font-semibold tracking-tight">{value}</p></div>)}</div>
    <div className="px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5">
      <p>{snapshot.sessionDate} {pick("미국 정규장 종가", "US regular-session close")} · {snapshot.bandAnchorDate}–{snapshot.bandEndDate ?? "—"}</p>
      {!summary.comparable && <p role="status" className="mt-1">{pick(summary.unavailableReason === "missing_basis" ? "앵커 시점의 σ 또는 관측 기준을 확인할 수 없어 평균을 표시하지 않습니다." : summary.unavailableReason === "mixed_basis" ? "스냅샷·밴드·σ 관측 기준이 일치하지 않아 평균을 표시하지 않습니다." : "유효한 σ 데이터가 없습니다.", "No comparable sigma basis is available for this summary.")}</p>}
      {!compact && <p className="mt-1">{pick("동일가중 관심목록 위치입니다. 포트폴리오 수익률·변동성이 아닙니다. 경계 밖 개수는 정확한 ±1σ 도달을 포함합니다.", "Equal-weight watchlist positions, not portfolio return or volatility. Counts include exact ±1σ touches.")}</p>}
      {!compact && symbols.length === 1 && <p className="mt-1">{pick("현재 1개 종목 기준입니다. 여러 종목을 저장해 비교하세요.", "Based on one symbol. Save more to compare your watchlist.")}</p>}
    </div>
    <div className="divide-y divide-border/50 border-t border-border/50">{attentionStocks(selected).map(stock => <Link prefetch={false} href={`/symbol/${stock.symbol}`} key={stock.symbol} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-muted/30 sm:px-5"><span className="font-semibold">{stock.symbol}</span><span className="ml-auto num">{formatSigma(stock.zScore)}</span><span className="text-xs text-muted-foreground">{isOutsideSigma(stock.zScore) ? pick(stock.zScore > 0 ? "상단 경계 밖" : "하단 경계 밖", stock.zScore > 0 ? "Upper band" : "Lower band") : isApproachingSigma(stock.zScore) ? pick("±1σ 경계 근접", "Near ±1σ") : pick("범위 안", "Inside")}</span></Link>)}</div>
    {onFilter && <div className="flex flex-wrap gap-2 border-t border-border/50 p-4">{(["all","outside","approaching"] as const).map(key => <button key={key} aria-pressed={filter === key} onClick={() => { onFilter(key); if (key === "outside") productEvent("my_sigma_outside_filter_click", "my_sigma"); }} className={`min-h-11 rounded-full border px-4 text-sm ${filter === key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}>{key === "all" ? pick("전체", "All") : key === "outside" ? pick("경계 밖", "Outside") : pick("경계 근접", "Near band")}</button>)}<p className="w-full text-xs text-muted-foreground">{pick("경계 근접: 0.85σ 이상, 1σ 미만", "Near band: 0.85 ≤ |σ| < 1")}</p></div>}
  </section>;
}
