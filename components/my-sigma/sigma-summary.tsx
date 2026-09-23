"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { summarizeWatchlistSigma, watchlistRows, attentionStocks, summarySymbolRows, type SigmaFilter } from "@/lib/watchlist-summary";
import { formatCurrency, formatPercent, formatSigma } from "@/lib/format";
import { isApproachingSigma, isOutsideSigma, STATUS_META } from "@/lib/sigma";
import { GEX_NEAR_SPOT_PERCENT, nearbyGexLevels } from "@/lib/gex-proximity";
import { productEvent } from "@/lib/product-events";
import { usePortfolio } from "@/hooks/use-portfolio";
import { valuePositions } from "@/lib/portfolio";
import type { MarketSnapshot, StockData } from "@/lib/types";

export function GexContext({ stock, session }: { stock: StockData; session: string }) {
  const { pick } = useLocale();
  const nearby = nearbyGexLevels(stock, session);
  if (nearby.state === "unavailable") return <span className="text-[11px] text-muted-foreground">{pick("GEX 자료 없음", "GEX unavailable")}</span>;
  if (nearby.state === "different_session") return <span className="text-[11px] text-muted-foreground">{pick("GEX 기준일 다름", "GEX date differs")} · OI {nearby.asOf}</span>;
  if (!nearby.levels.length) return <span className="text-[11px] text-muted-foreground">{pick("근접 GEX 없음", "No nearby GEX")}</span>;
  return <>{nearby.levels.map(level => <span key={level.id} className={`inline-flex flex-wrap items-center gap-x-1.5 rounded-md px-2 py-1 text-[11px] ${level.role === "support" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
    <span className="font-medium">{level.role === "support" ? pick("GEX 지지 근접", "Near GEX support") : pick("GEX 저항 근접", "Near GEX resistance")}</span>
    <span className="num">{formatCurrency(level.price)} · {formatPercent(level.distancePercent)}</span>
  </span>)}</>;
}

export function SigmaSummary({ symbols, stocks, snapshot, compact = false, filter = "all", onFilter }: {
  symbols: string[]; stocks: StockData[]; snapshot: MarketSnapshot; compact?: boolean; filter?: SigmaFilter; onFilter?: (filter: SigmaFilter) => void;
}) {
  const { pick } = useLocale();
  const summary = summarizeWatchlistSigma(watchlistRows(symbols, stocks, snapshot));
  const allRows = summarySymbolRows(symbols, stocks, "all");
  const rows = compact
    ? attentionStocks(allRows.flatMap(row => row.stock ? [row.stock] : [])).map(stock => ({ symbol: stock.symbol, stock }))
    : summarySymbolRows(symbols, stocks, filter);
  const counts = {
    all: allRows.length,
    outside: allRows.filter(row => row.stock && isOutsideSigma(row.stock.zScore)).length,
    approaching: allRows.filter(row => row.stock && isApproachingSigma(row.stock.zScore)).length,
  };
  // Holdings are read, never merged into the list: a held symbol that is not
  // starred stays out, and a starred one shows what share of the portfolio it is.
  const portfolio = usePortfolio();
  const held = new Map(portfolio.ready && !portfolio.error ? valuePositions(portfolio.value.positions, stocks).rows.map(row => [row.symbol, row.weight]) : []);
  const heldLabel = (weight: number | null) => weight === null ? pick("보유", "Held") : weight < 1 ? pick("보유 <1%", "Held <1%") : pick(`보유 ${Math.round(weight)}%`, `Held ${Math.round(weight)}%`);
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
    [pick("±1σ 경계 밖", "At / outside ±1σ"), summary.outsideCount === null ? "—" : `${summary.outsideCount} / ${summary.totalCount}`],
  ];
  return <section aria-label={pick("My Sigma 요약", "My Sigma summary")} className="glass overflow-hidden rounded-2xl">
    <div className="grid grid-cols-2 divide-x divide-border/50 border-b border-border/50">{values.map(([label, value]) => <div key={label} className="px-4 py-5 sm:px-5"><p className="text-xs text-muted-foreground">{label}</p><p className="num mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p></div>)}</div>
    <div className="px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5">
      <p>{snapshot.sessionDate} {pick("미국 종가", "US close")} · {pick("주간 밴드", "Weekly band")} {snapshot.bandAnchorDate.slice(5).replace("-", "/")}–{snapshot.bandEndDate?.slice(5).replace("-", "/") ?? "—"}</p>
      {!summary.comparable && <p role="status" className="mt-1">{pick(summary.unavailableReason === "missing_basis" ? "앵커 시점의 σ 또는 관측 기준을 확인할 수 없어 평균을 표시하지 않습니다." : summary.unavailableReason === "mixed_basis" ? "스냅샷·밴드·σ 관측 기준이 일치하지 않아 평균을 표시하지 않습니다." : "유효한 σ 데이터가 없습니다.", "No comparable sigma basis is available for this summary.")}</p>}
      {summary.validCount > 0 && summary.validCount < summary.totalCount && <p className="mt-1">{pick("자료가 없는 종목은 평균에서 제외됩니다.", "Unavailable symbols are excluded from the mean.")}</p>}
    </div>
    {onFilter && <div className="flex flex-wrap gap-1.5 border-t border-border/50 px-4 py-3 sm:px-5" role="group" aria-label={pick("요약 종목 필터", "Summary symbol filter")}>
      {(["all", "outside", "approaching"] as const).map(key => <button key={key} type="button" aria-pressed={filter === key} onClick={() => { onFilter(key); if (key === "outside") productEvent("my_sigma_outside_filter_click", "my_sigma"); }} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors sm:px-4 sm:text-sm ${filter === key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
        {key === "all" ? pick("전체", "All") : key === "outside" ? pick("경계 밖", "Outside") : pick("경계 근접", "Near band")}<span className="num opacity-65">{counts[key]}</span>
      </button>)}
    </div>}
    <ul aria-label={pick("요약 종목 목록", "Summary symbols")} className="divide-y divide-border/50 border-t border-border/50">
      {rows.map(({ symbol, stock }) => <li key={symbol}>
        {stock ? <Link prefetch={false} href={`/symbol/${symbol}`} className="group block px-4 py-3 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0"><span className="text-sm font-semibold tracking-wide">{symbol}</span><span className="num ml-2 text-xs text-muted-foreground">{formatCurrency(stock.price)}</span>{held.has(symbol) && <span className="num ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{heldLabel(held.get(symbol) ?? null)}</span>}</div>
            <div className="ml-auto shrink-0 text-right"><span className="num text-base font-semibold" style={{ color: `var(${STATUS_META[stock.status].colorVar})` }}>{formatSigma(stock.zScore)}</span><p className="mt-0.5 text-[11px] text-muted-foreground">{!Number.isFinite(stock.zScore) ? pick("σ 자료 없음", "Sigma unavailable") : isOutsideSigma(stock.zScore) ? pick(stock.zScore > 0 ? "상단 경계 밖" : "하단 경계 밖", stock.zScore > 0 ? "Upper band" : "Lower band") : isApproachingSigma(stock.zScore) ? pick("±1σ 경계 근접", "Near ±1σ") : pick("범위 안", "Inside band")}</p></div>
            <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><GexContext stock={stock} session={snapshot.sessionDate} /></div>
        </Link> : <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-5"><span className="text-sm font-semibold">{symbol}</span><span className="text-xs text-muted-foreground">{pick("자료 없음 · 저장 유지", "Unavailable · still saved")}</span></div>}
      </li>)}
    </ul>
    {!rows.length && <p role="status" className="px-4 py-5 text-sm text-muted-foreground sm:px-5">{pick("이 조건에 해당하는 종목이 없습니다.", "No symbols match this filter.")}</p>}
    {compact && symbols.length > rows.length && <Link href="/my-sigma" className="flex min-h-11 items-center justify-center border-t border-border/50 text-xs text-muted-foreground">{pick(`전체 ${symbols.length}개 종목 보기`, `View all ${symbols.length} symbols`)}<ChevronRight aria-hidden className="ml-1 size-3" /></Link>}
    {!compact && <details className="border-t border-border/50 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground sm:px-5"><summary className="w-fit cursor-pointer py-1">{pick("표시 기준", "Display basis")}</summary>
      <p className="mt-2">{pick("평균은 동일가중 σ 위치입니다. 경계 밖은 ±1σ 도달을 포함하며, 경계 근접은 0.85 ≤ |σ| < 1입니다.", "The mean is an equal-weight sigma position. Outside includes exact ±1σ; near band means 0.85 ≤ |σ| < 1.")}</p>
      <p className="mt-1">{pick(`GEX 근접은 종가 ±${GEX_NEAR_SPOT_PERCENT}% 안의 지지·저항 후보(S1/S2·R1/R2)입니다. OI 기준일이 종가 세션과 다르면 근접 판정을 생략합니다. 지지·저항 효과는 미검증입니다.`, `Nearby GEX means published support/resistance candidates (S1/S2, R1/R2) within ${GEX_NEAR_SPOT_PERCENT}% of the close. Proximity is omitted when the OI date differs from the close session. Support/resistance efficacy is unverified.`)}</p>
    </details>}
  </section>;
}
