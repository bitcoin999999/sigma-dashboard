"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useLocale } from "@/components/locale-provider";
import { formatPercent } from "@/lib/format";
import { validMarketHistory } from "@/lib/market-history";
import {
  PERIODS,
  portfolioHistory,
  positionsPerformance,
  type PortfolioPeriod,
  type Position,
  type PriceHistory,
  type PricePoint,
} from "@/lib/portfolio";
import type { MarketSnapshot, StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Opened on the longest of these the data can actually cover. */
const PREFERRED: PortfolioPeriod[] = ["3M", "1M", "1W"];
type Benchmark = "SPY" | "QQQ" | "";

export function PortfolioPerformance({ positions, stocks, snapshot }: { positions: Position[]; stocks: StockData[]; snapshot: MarketSnapshot }) {
  const { pick } = useLocale();
  const [chosen, setChosen] = React.useState<PortfolioPeriod | null>(null);
  const [benchmark, setBenchmark] = React.useState<Benchmark>("SPY");
  const [fetched, setFetched] = React.useState<Record<string, PricePoint[] | null>>({});
  const requested = React.useRef(new Set<string>());
  const base = React.useMemo(() => portfolioHistory(stocks), [stocks]);

  // SPY is the session calendar that exposes jointly missing days, so it loads
  // even when the comparison line is QQQ or none.
  const wanted = [...new Set([...positions.filter((p) => p.quantity !== null).map((p) => p.symbol), "SPY", ...(benchmark ? [benchmark] : [])])].sort().join(",");
  React.useEffect(() => {
    for (const symbol of wanted.split(",")) {
      if (!symbol || requested.current.has(symbol)) continue;
      requested.current.add(symbol);
      fetch(`/api/history/${encodeURIComponent(symbol)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: unknown) => setFetched((prev) => ({ ...prev, [symbol]: validMarketHistory(data, symbol) ? data.prices : null })))
        .catch(() => setFetched((prev) => ({ ...prev, [symbol]: null })));
    }
  }, [wanted]);

  const pending = wanted.split(",").some((symbol) => !(symbol in fetched));
  const prices: PriceHistory = { ...base };
  for (const [symbol, list] of Object.entries(fetched)) if (list) prices[symbol] = list;

  const end = snapshot.sessionDate;
  const results = Object.fromEntries(PERIODS.map((p) => [p, positionsPerformance(positions, prices, p, end)])) as Record<PortfolioPeriod, ReturnType<typeof positionsPerformance>>;
  const available = PERIODS.filter((p) => results[p].reason === null);
  const period = chosen ?? PREFERRED.find((p) => available.includes(p)) ?? available[0] ?? "3M";
  const performance = results[period];
  const comparison = benchmark ? positionsPerformance([{ symbol: benchmark, quantity: 1, averageCost: null }], prices, period, end) : null;
  const matching = comparison?.reason === null && comparison.start === performance.start ? comparison : null;
  const byDate = new Map(matching?.points.map((p) => [p.date, p.returnPercent]));
  const chart = performance.points.map((p) => ({ ...p, benchmark: byDate.get(p.date) }));
  const contributions = [...performance.contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const names = performance.limiting.join(", ");
  const failure = performance.reason === "no_position" ? pick("수량을 입력한 종목이 생기면 기간 수익률을 계산합니다.", "Enter a size to see the period return.")
    : performance.reason === "missing_price" ? pick(`${names}의 현재 가격이 없어 계산할 수 없습니다.`, `No current price for ${names}.`)
    : performance.reason === "history_gap" ? pick(`${names}의 가격 이력에 빠진 날이 있어 이 기간은 계산하지 않습니다.`, `${names} has missing sessions in this window.`)
    : names ? pick(`${names}의 가격 이력이 이 기간보다 짧습니다. 더 짧은 기간을 선택하세요.`, `${names} has less history than this period. Choose a shorter one.`)
    : pick("이 기간의 가격 이력이 부족합니다. 더 짧은 기간을 선택하세요.", "Not enough history for this period. Choose a shorter one.");
  const tone = (value: number | null) => (value === null ? "" : value > 0 ? "text-up" : value < 0 ? "text-down" : "");

  return (
    <section aria-labelledby="portfolio-performance" className="glass rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="portfolio-performance" className="text-sm font-semibold">{pick("기간 수익률", "Period return")}</h2>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
            <span className={cn("num text-3xl font-semibold tracking-tight", tone(performance.returnPercent))}>{performance.returnPercent === null ? "—" : formatPercent(performance.returnPercent)}</span>
            {matching && <span className="num text-sm text-muted-foreground">{benchmark} {formatPercent(matching.returnPercent ?? NaN)}</span>}
          </p>
          <p className="num mt-1 text-xs text-muted-foreground">{performance.start ?? "—"} → {end}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {pick("비교", "Compare")}
          <select className="min-h-11 rounded-lg border border-border bg-background px-2 text-sm text-foreground" value={benchmark} onChange={(event) => setBenchmark(event.target.value as Benchmark)}>
            <option value="SPY">SPY</option>
            <option value="QQQ">QQQ</option>
            <option value="">{pick("없음", "None")}</option>
          </select>
        </label>
      </div>

      <div role="group" aria-label={pick("기간", "Period")} className="mt-4 flex flex-wrap gap-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            disabled={!pending && !available.includes(p) && period !== p}
            onClick={() => setChosen(p)}
            className={cn("min-h-11 min-w-11 rounded-lg px-3 text-xs disabled:opacity-35", period === p ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/40")}
          >
            {p}
          </button>
        ))}
      </div>

      {chart.length > 1 ? (
        <div className="mt-4 h-60 min-w-0 overflow-hidden sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} minTickGap={50} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <YAxis width={52} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Tooltip formatter={(v, name) => [formatPercent(Number(v)), name]} contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} />
              <Line type="linear" dataKey="returnPercent" name={pick("내 포트폴리오", "My portfolio")} stroke="var(--primary)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              {matching && <Line dataKey="benchmark" name={benchmark} stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p role="status" className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">
          {pending && performance.reason !== "no_position" ? pick("가격 이력을 불러오는 중…", "Loading price history…") : failure}
        </p>
      )}

      {contributions.length > 1 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">{pick("수익 기여 (%p)", "Contribution (pp)")}</p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {contributions.map((c) => (
              <li key={c.symbol} className="num text-xs">
                {c.symbol} <span className={tone(c.contribution)}>{c.contribution >= 0 ? "+" : "−"}{Math.abs(c.contribution).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {pick("지금의 보유 수량을 기간 내내 그대로 들고 있었다고 가정한 가격 수익률입니다. 매매·배당·환율·비용은 반영하지 않으며 실제 계좌 수익률이 아닙니다.", "Price return of today’s sizes held unchanged through the window. Excludes trades, dividends, FX and costs; not an account return.")}
      </p>
    </section>
  );
}
